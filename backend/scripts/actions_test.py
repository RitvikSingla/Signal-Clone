"""Checks for the message-action and attachment endpoints.

Run with the API on :8000 and a seeded database:

    python scripts/actions_test.py

Covers pin (with the pinned event and the three-pin cap), unpin, delete for
me, forward (including attachment copies), message info, and upload safety:
a real image gets dimensions, an HTML file is stored as an opaque download,
and an oversized file is refused.
"""

from __future__ import annotations

import io
import sqlite3
import sys
from pathlib import Path

import httpx
from PIL import Image

BASE = "http://localhost:8000"
API = f"{BASE}/api/v1"
failures: list[str] = []


def check(label: str, ok: bool, detail: object = "") -> None:
    print(("  ok    " if ok else "  FAIL  ") + label + (f"  ({detail})" if not ok else ""))
    if not ok:
        failures.append(label)


def login(client: httpx.Client, phone: str) -> dict:
    client.post(f"{API}/auth/request-code", json={"phone_number": phone})
    token = client.post(
        f"{API}/auth/verify", json={"phone_number": phone, "code": "123456"}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def main() -> None:
    with httpx.Client(timeout=20) as client:
        me = login(client, "+919812345601")  # Ritvik
        aarav = login(client, "+919812345602")

        convs = client.get(f"{API}/conversations", headers=me).json()
        direct = next(c for c in convs if c["title"] == "Aarav Mehta")
        priya = next(c for c in convs if c["title"] == "Priya Nair")
        page = client.get(f"{API}/conversations/{direct['id']}/messages", headers=me).json()
        texts = [m for m in page["messages"] if m["type"] == "text"]
        target = texts[-1]

        # --- pin ---------------------------------------------------------
        r = client.put(f"{API}/messages/{target['id']}/pin", json={"duration_seconds": 86400}, headers=me)
        check("pin returns the pinned message", r.status_code == 200 and r.json()["pinned_at"], r.text)
        pins = client.get(f"{API}/conversations/{direct['id']}/pins", headers=aarav).json()
        check("the other member sees the pin", any(p["id"] == target["id"] for p in pins), pins)
        page = client.get(f"{API}/conversations/{direct['id']}/messages", headers=me).json()
        event = page["messages"][-1]
        check(
            "a 'pinned' event row links to the target",
            event["event"] == "pinned" and event["reply_to"]["id"] == target["id"],
            event,
        )
        for extra in texts[-4:-1]:
            client.put(f"{API}/messages/{extra['id']}/pin", json={"duration_seconds": None}, headers=me)
        pins = client.get(f"{API}/conversations/{direct['id']}/pins", headers=me).json()
        check("at most three pins are live", len(pins) == 3, len(pins))
        check("the oldest pin was dropped", all(p["id"] != target["id"] for p in pins))
        for pin in pins:
            client.delete(f"{API}/messages/{pin['id']}/pin", headers=me)
        pins = client.get(f"{API}/conversations/{direct['id']}/pins", headers=me).json()
        check("unpin clears every pin", pins == [], pins)

        # --- delete for me ----------------------------------------------
        hide_target = texts[0]
        r = client.post(f"{API}/messages/{hide_target['id']}/hide", headers=me)
        check("hide returns 204", r.status_code == 204, r.status_code)
        mine = client.get(f"{API}/conversations/{direct['id']}/messages?limit=100", headers=me).json()
        theirs = client.get(f"{API}/conversations/{direct['id']}/messages?limit=100", headers=aarav).json()
        check("hidden for me", all(m["id"] != hide_target["id"] for m in mine["messages"]))
        check("still there for them", any(m["id"] == hide_target["id"] for m in theirs["messages"]))

        # --- upload --------------------------------------------------------
        buffer = io.BytesIO()
        Image.new("RGB", (1600, 900), (44, 107, 237)).save(buffer, "PNG")
        r = client.post(
            f"{API}/attachments",
            files={"file": ("photo.png", buffer.getvalue(), "image/png")},
            headers=me,
        )
        image = r.json()
        check(
            "image upload records dimensions and a thumbnail",
            r.status_code == 201 and image["width"] == 1600 and image["thumbnail_url"],
            r.text,
        )
        media = client.get(f"{BASE}{image['url']}")
        check("the image is served", media.status_code == 200 and media.headers["content-type"] == "image/png")
        check("media responses carry nosniff", media.headers.get("x-content-type-options") == "nosniff")

        r = client.post(
            f"{API}/attachments",
            files={"file": ("evil.html", b"<script>alert(1)</script>", "text/html")},
            headers=me,
        )
        html = r.json()
        check("html is stored as an opaque .bin", html["url"].endswith(".bin"), html)
        served = client.get(f"{BASE}{html['url']}")
        check(
            "and served as a download",
            served.headers.get("content-disposition") == "attachment",
            served.headers,
        )

        r = client.post(
            f"{API}/attachments",
            files={"file": ("big.bin", b"0" * (10 * 1024 * 1024 + 1), "application/octet-stream")},
            headers=me,
        )
        check("oversized upload is refused with 413", r.status_code == 413, r.status_code)

        # --- send with attachment, then forward -------------------------
        r = client.post(
            f"{API}/conversations/{direct['id']}/messages",
            json={"client_id": "actions-test-photo", "body": "Look", "attachment_ids": [image["id"]]},
            headers=me,
        )
        sent = r.json()
        check("message with an image is type image", sent.get("type") == "image", r.text)
        r = client.post(
            f"{API}/conversations/{direct['id']}/messages",
            json={"client_id": "actions-test-reuse", "attachment_ids": [image["id"]]},
            headers=me,
        )
        check("an attachment cannot be attached twice", r.status_code == 404, r.status_code)

        r = client.post(
            f"{API}/messages/forward",
            json={"message_ids": [sent["id"]], "conversation_ids": [priya["id"]]},
            headers=me,
        )
        forwarded = r.json()
        check(
            "forward creates a marked copy with the file",
            r.status_code == 200
            and forwarded[0]["is_forwarded"]
            and forwarded[0]["attachments"][0]["url"] == sent["attachments"][0]["url"],
            r.text,
        )

        # --- search --------------------------------------------------------
        hits = client.get(f"{API}/messages/search", params={"q": "sto"}, headers=me).json()
        check("search matches word prefixes", any("stove" in (h["body"] or "").lower() for h in hits), hits)
        scoped = client.get(
            f"{API}/messages/search",
            params={"q": "sto", "conversation_id": direct["id"]},
            headers=me,
        ).json()
        check(
            "chat-scoped search stays in that chat",
            scoped and all(h["conversation_id"] == direct["id"] for h in scoped),
            scoped,
        )
        check("hits carry the sender id", all(h.get("sender_id") for h in scoped), scoped)
        hidden_hits = client.get(
            f"{API}/messages/search",
            params={"q": (hide_target["body"] or "x").split()[0], "conversation_id": direct["id"]},
            headers=me,
        ).json()
        check(
            "messages deleted for me do not show in search",
            all(h["message_id"] != hide_target["id"] for h in hidden_hits),
            hidden_hits,
        )

        # --- voice note ------------------------------------------------------
        r = client.post(
            f"{API}/attachments",
            files={"file": ("voice-message.weba", b"\x1aE\xdf\xa3" + b"\x00" * 64, "audio/webm")},
            headers=me,
        )
        check(
            "a voice note is stored as audio, not video",
            r.status_code == 201 and r.json()["content_type"] == "audio/webm",
            r.text,
        )

        # --- info ----------------------------------------------------------
        info = client.get(f"{API}/messages/{sent['id']}/info", headers=me).json()
        check("sender's info lists the recipient", len(info["receipts"]) == 1, info)
        info = client.get(f"{API}/messages/{sent['id']}/info", headers=aarav).json()
        check("recipient's info lists only themselves", len(info["receipts"]) == 1)

        # --- search index stays consistent --------------------------------
        # A message with no text that later changes status (a read tick)
        # used to corrupt the FTS5 index; see migration c9e2f1a4b6d8.
        buffer = io.BytesIO()
        Image.new("RGB", (40, 40), (10, 10, 10)).save(buffer, "PNG")
        bare = client.post(
            f"{API}/attachments",
            files={"file": ("bare.png", buffer.getvalue(), "image/png")},
            headers=me,
        ).json()
        sent = client.post(
            f"{API}/conversations/{direct['id']}/messages",
            json={"client_id": "actions-test-bare", "attachment_ids": [bare["id"]]},
            headers=me,
        ).json()
        client.post(
            f"{API}/conversations/{direct['id']}/read",
            json={"last_message_id": sent["id"]},
            headers=aarav,
        )
        database = Path(__file__).resolve().parent.parent / "signal.db"
        if database.exists():
            label = "search index intact after a caption-less photo is read"
            try:
                with sqlite3.connect(database) as db:
                    db.execute(
                        "INSERT INTO messages_fts(messages_fts, rank) VALUES('integrity-check', 1)"
                    )
                check(label, True)
            except sqlite3.DatabaseError as exc:
                check(label, False, exc)

    print(f"\n{len(failures)} failures" if failures else "\nAll checks passed.")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
