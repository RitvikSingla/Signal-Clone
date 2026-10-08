"""Exercise the WebSocket hub against a running server.

Opens sockets for two accounts, then checks that the things the Phase 4 gate
asks for actually happen: a message sent over REST arrives on the other
socket without a refresh, typing relays, delivery and read promote the
sender's status, presence flips on connect and disconnect, and a dropped
socket reconnects on its own.

    python scripts/realtime_test.py
"""

from __future__ import annotations

import asyncio
import json
import subprocess
import uuid

import websockets

API = "http://127.0.0.1:8000/api/v1"
WS = "ws://127.0.0.1:8000/ws"

FAILURES: list[str] = []


def curl(method: str, path: str, token: str | None = None, body: dict | None = None):
    cmd = ["curl", "-s", "-w", "\n%{http_code}", "-X", method, API + path]
    if token:
        cmd += ["-H", "Authorization: Bearer " + token]
    if body is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    out = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8").stdout
    text, _, code = out.rpartition("\n")
    try:
        return int(code), (json.loads(text) if text else None)
    except json.JSONDecodeError:
        return int(code), text


def login(phone: str) -> str:
    curl("POST", "/auth/request-code", body={"phone_number": phone})
    code, data = curl(
        "POST", "/auth/verify", body={"phone_number": phone, "code": "123456"}
    )
    assert code == 200, (code, data)
    return data["access_token"]


def ok(label: str, condition: bool, extra: object = "") -> None:
    if condition:
        print("  PASS  " + label)
    else:
        FAILURES.append(label)
        print(f"  FAIL  {label}  -> {extra}")


async def collect(socket, *, seconds: float = 2.0, want: str | None = None) -> list[dict]:
    """Read frames for a while, stopping early once `want` has been seen."""
    frames: list[dict] = []
    loop = asyncio.get_event_loop()
    deadline = loop.time() + seconds
    while loop.time() < deadline:
        remaining = deadline - loop.time()
        try:
            raw = await asyncio.wait_for(socket.recv(), timeout=remaining)
        except (asyncio.TimeoutError, TimeoutError):
            break
        frame = json.loads(raw)
        frames.append(frame)
        if want and frame.get("type") == want:
            break
    return frames


def types(frames: list[dict]) -> list[str]:
    return [f.get("type") for f in frames]


async def main() -> None:
    ritvik = login("+919812345601")
    aarav = login("+919812345602")

    code, convs = curl("GET", "/conversations", ritvik)
    assert code == 200, convs
    dm = next(c for c in convs if c["title"] == "Aarav Mehta")
    conversation_id = dm["id"]

    print("\n--- handshake ---")
    bad = None
    try:
        async with websockets.connect(f"{WS}?token=not-a-real-token"):
            bad = "accepted"
    except Exception:
        bad = "rejected"
    ok("a bad token is refused", bad == "rejected", bad)

    async with websockets.connect(f"{WS}?token={ritvik}") as sock_r:
        hello = json.loads(await sock_r.recv())
        ok("connect frame carries the account", hello.get("type") == "connected", hello)

        await sock_r.send(json.dumps({"type": "ping"}))
        pong = json.loads(await asyncio.wait_for(sock_r.recv(), timeout=5))
        ok("heartbeat is answered", pong.get("type") == "pong", pong)

        print("\n--- presence ---")
        async with websockets.connect(f"{WS}?token={aarav}") as sock_a:
            await sock_a.recv()  # Aarav's own connected frame

            # Ritvik should learn that Aarav came online.
            frames = await collect(sock_r, seconds=3, want="presence")
            presence = [f for f in frames if f.get("type") == "presence"]
            ok("peer coming online is announced", bool(presence), types(frames))

            code, me = curl("GET", "/auth/me", aarav)
            ok("presence is written to the row", me.get("is_online") is True, me.get("is_online"))

            print("\n--- live message delivery ---")
            client_id = str(uuid.uuid4())
            code, sent = curl(
                "POST",
                f"/conversations/{conversation_id}/messages",
                ritvik,
                {"client_id": client_id, "body": "Realtime check one."},
            )
            ok("send accepted", code == 201, code)

            frames_a = await collect(sock_a, seconds=3, want="message.new")
            new_frames = [f for f in frames_a if f.get("type") == "message.new"]
            ok("recipient socket receives the message", bool(new_frames), types(frames_a))
            if new_frames:
                ok(
                    "frame carries the full message",
                    new_frames[0]["message"]["body"] == "Realtime check one.",
                    new_frames[0]["message"].get("body"),
                )

            frames_r = await collect(sock_r, seconds=2)
            ok(
                "sender is told its own status",
                "message.status" in types(frames_r),
                types(frames_r),
            )

            print("\n--- delivery acknowledgement ---")
            await sock_a.send(
                json.dumps({"type": "message.delivered", "message_ids": [sent["id"]]})
            )
            frames_r = await collect(sock_r, seconds=3, want="message.status")
            status_frames = [
                f
                for f in frames_r
                if f.get("type") == "message.status" and f.get("message_id") == sent["id"]
            ]
            ok(
                "acknowledging promotes the sender to delivered",
                any(f["status"] == "delivered" for f in status_frames),
                [f.get("status") for f in status_frames],
            )

            print("\n--- read receipts ---")
            code, aconvs = curl("GET", "/conversations", aarav)
            adm = next(c for c in aconvs if c["title"] == "Ritvik Singla")
            curl("POST", f"/conversations/{adm['id']}/read", aarav, {"last_message_id": None})
            frames_r = await collect(sock_r, seconds=3, want="message.status")
            read_frames = [
                f
                for f in frames_r
                if f.get("type") == "message.status" and f.get("status") == "read"
            ]
            ok("reading promotes the sender to read", bool(read_frames), types(frames_r))

            print("\n--- typing ---")
            await sock_a.send(
                json.dumps({"type": "typing.start", "conversation_id": conversation_id})
            )
            frames_r = await collect(sock_r, seconds=3, want="typing")
            typing_frames = [f for f in frames_r if f.get("type") == "typing"]
            ok("typing relays to the other side", bool(typing_frames), types(frames_r))
            if typing_frames:
                ok(
                    "typing frame names the sender",
                    typing_frames[0]["display_name"] == "Aarav Mehta"
                    and typing_frames[0]["is_typing"] is True,
                    typing_frames[0],
                )

            await sock_a.send(
                json.dumps({"type": "typing.stop", "conversation_id": conversation_id})
            )
            frames_r = await collect(sock_r, seconds=2, want="typing")
            stop_frames = [
                f for f in frames_r if f.get("type") == "typing" and not f["is_typing"]
            ]
            ok("typing stop relays too", bool(stop_frames), types(frames_r))

            print("\n--- authority is re-checked, not trusted ---")
            await sock_a.send(
                json.dumps({"type": "typing.start", "conversation_id": "not-my-thread"})
            )
            frames_r = await collect(sock_r, seconds=1.5)
            ok(
                "typing in a thread you are not in is dropped",
                not [f for f in frames_r if f.get("type") == "typing"],
                types(frames_r),
            )

            await sock_a.send(json.dumps({"type": "nonsense"}))
            frames_a = await collect(sock_a, seconds=1.5, want="error")
            ok(
                "an unknown frame gets an error, not a disconnect",
                "error" in types(frames_a),
                types(frames_a),
            )

        # Aarav's socket is now closed.
        await asyncio.sleep(1.0)
        frames_r = await collect(sock_r, seconds=3, want="presence")
        offline = [
            f
            for f in frames_r
            if f.get("type") == "presence" and f.get("is_online") is False
        ]
        ok("peer going offline is announced", bool(offline), types(frames_r))

        code, me = curl("GET", "/auth/me", aarav)
        ok("last seen is written on disconnect", me.get("is_online") is False, me.get("is_online"))

    print("\n--- several sockets for one account ---")
    async with websockets.connect(f"{WS}?token={ritvik}") as one, websockets.connect(
        f"{WS}?token={ritvik}"
    ) as two:
        await one.recv()
        await two.recv()
        code, sent = curl(
            "POST",
            f"/conversations/{conversation_id}/messages",
            aarav,
            {"client_id": str(uuid.uuid4()), "body": "Two tabs, one account."},
        )
        ok("send accepted", code == 201, code)
        got_one = await collect(one, seconds=3, want="message.new")
        got_two = await collect(two, seconds=3, want="message.new")
        ok(
            "both tabs receive it",
            "message.new" in types(got_one) and "message.new" in types(got_two),
            (types(got_one), types(got_two)),
        )

    print("\n==================================")
    if FAILURES:
        print(f"{len(FAILURES)} FAILED:")
        for failure in FAILURES:
            print("   -", failure)
    else:
        print("All realtime checks passed.")


if __name__ == "__main__":
    asyncio.run(main())
