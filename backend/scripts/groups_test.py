"""Checks for group administration and disappearing messages.

Run with the API on :8000 and a seeded database:

    python scripts/groups_test.py

Walks the flow from the reference recording: create a group with a timer,
group updates carrying their actor, add and remove members, roles, member
labels, the four permissions, the group link (on, approval, reset, join,
request, approve), ending a group, clearing a chat, muting, and a
disappearing message actually disappearing (with a live socket frame).
"""

from __future__ import annotations

import asyncio
import json
import sys
import time

import httpx
import websockets

BASE = "http://localhost:8000"
API = f"{BASE}/api/v1"
WS = "ws://localhost:8000/ws"
failures: list[str] = []


def check(label: str, ok: bool, detail: object = "") -> None:
    print(("  ok    " if ok else "  FAIL  ") + label + (f"  ({detail})" if not ok else ""))
    if not ok:
        failures.append(label)


def login(client: httpx.Client, phone: str) -> tuple[dict, str]:
    client.post(f"{API}/auth/request-code", json={"phone_number": phone})
    data = client.post(f"{API}/auth/verify", json={"phone_number": phone, "code": "123456"}).json()
    return {"Authorization": f"Bearer {data['access_token']}"}, data["access_token"]


def main() -> None:
    with httpx.Client(timeout=20) as c:
        me, _ = login(c, "+919812345601")  # Ritvik
        aarav, aarav_token = login(c, "+919812345602")
        priya, _ = login(c, "+919812345603")
        kenji, _ = login(c, "+819012345606")
        ids = {
            name: c.get(f"{API}/auth/me", headers=h).json()["id"]
            for name, h in (("me", me), ("aarav", aarav), ("priya", priya), ("kenji", kenji))
        }

        # --- create -----------------------------------------------------------
        r = c.post(
            f"{API}/conversations/group",
            json={"name": "Friend", "member_ids": [ids["aarav"]], "disappearing_seconds": 3600},
            headers=me,
        )
        group = r.json()
        gid = group["id"]
        check("create group with a timer", r.status_code == 201 and group["disappearing_seconds"] == 3600, r.text)
        check("creator is admin", group["my_role"] == "admin")
        check("defaults: all permissions open", group["permissions"]["send_messages"] == "all")
        empty = c.post(f"{API}/conversations/group", json={"name": "Solo"}, headers=me)
        check("a group can start with nobody else (Skip)", empty.status_code == 201, empty.text)

        page = c.get(f"{API}/conversations/{gid}/messages", headers=aarav).json()["messages"]
        created = page[0]
        check(
            "update event names its actor",
            created["type"] == "system"
            and created["body"] == "created the group."
            and created["sender"]["id"] == ids["me"],
            created,
        )
        check("timer event recorded", page[-1]["event"] == "timer" and "1 hour" in page[-1]["body"], page[-1])
        listing = c.get(f"{API}/conversations", headers=aarav).json()
        row = next(x for x in listing if x["id"] == gid)
        check("group updates do not raise the unread badge", row["unread_count"] == 0, row)

        # --- members and roles --------------------------------------------
        r = c.post(f"{API}/conversations/{gid}/members", json={"user_ids": [ids["priya"]]}, headers=me)
        check("admin adds a member", r.status_code == 200 and len([m for m in r.json()["members"] if m["is_active"]]) == 3, r.text)
        r = c.patch(f"{API}/conversations/{gid}/members/{ids['aarav']}", json={"role": "admin"}, headers=me)
        check("make admin", any(m["user"]["id"] == ids["aarav"] and m["role"] == "admin" for m in r.json()["members"]))
        r = c.patch(f"{API}/conversations/{gid}/members/{ids['aarav']}", json={"role": "member"}, headers=me)
        last = c.get(f"{API}/conversations/{gid}/messages", headers=me).json()["messages"][-1]
        check("revoke admin is recorded", "revoked admin privileges" in last["body"], last)
        r = c.delete(f"{API}/conversations/{gid}/members/{ids['priya']}", headers=priya)
        check("a member cannot remove anyone", r.status_code == 403, r.status_code)
        r = c.delete(f"{API}/conversations/{gid}/members/{ids['priya']}", headers=me)
        check("admin removes a member", r.status_code == 200, r.text)

        # --- labels ----------------------------------------------------------
        r = c.put(f"{API}/conversations/{gid}/label", json={"label": "RS"}, headers=me)
        mine = next(m for m in r.json()["members"] if m["user"]["id"] == ids["me"])
        check("set my member label", mine["label"] == "RS", mine)

        # --- permissions -----------------------------------------------------
        r = c.patch(f"{API}/conversations/{gid}/permissions", json={"send_messages": "admins", "add_members": "admins"}, headers=aarav)
        check("only admins change permissions", r.status_code == 403, r.status_code)
        r = c.patch(f"{API}/conversations/{gid}/permissions", json={"send_messages": "admins", "add_members": "admins"}, headers=me)
        check("admin restricts sending", r.json()["permissions"]["send_messages"] == "admins", r.text)
        detail = c.get(f"{API}/conversations/{gid}", headers=aarav).json()
        check("member is told they cannot send", detail["can_send"] is False, detail.get("can_send"))
        r = c.post(f"{API}/conversations/{gid}/messages", json={"client_id": "g-blocked", "body": "hi"}, headers=aarav)
        check("member send refused while admins-only", r.status_code == 403, r.status_code)
        r = c.post(f"{API}/conversations/{gid}/members", json={"user_ids": [ids["kenji"]]}, headers=aarav)
        check("member add refused while admins-only", r.status_code == 403, r.status_code)
        r = c.patch(f"{API}/conversations/{gid}/permissions", json={"send_messages": "all"}, headers=me)
        r = c.post(f"{API}/conversations/{gid}/messages", json={"client_id": "g-ok", "body": "hi all"}, headers=aarav)
        check("member can send again", r.status_code == 201, r.status_code)

        # --- group link -------------------------------------------------------
        r = c.patch(f"{API}/conversations/{gid}/link", json={"enabled": True}, headers=me)
        link = r.json()["group_link"]
        check("turn on the group link", link["enabled"] and link["token"], link)
        member_view = c.get(f"{API}/conversations/{gid}", headers=aarav).json()["group_link"]
        check("members do not see the link token", member_view["token"] is None, member_view)
        token = link["token"]
        preview = c.get(f"{API}/conversations/group-link/{token}", headers=kenji).json()
        check("link preview", preview["title"] == "Friend" and preview["status"] == "none", preview)
        joined = c.post(f"{API}/conversations/group-link/{token}", headers=kenji).json()
        check("join via link", joined["status"] == "joined", joined)
        c.delete(f"{API}/conversations/{gid}/members/{ids['kenji']}", headers=me)

        c.patch(f"{API}/conversations/{gid}/link", json={"requires_approval": True}, headers=me)
        requested = c.post(f"{API}/conversations/group-link/{token}", headers=kenji).json()
        check("approval turns joining into a request", requested["status"] == "requested", requested)
        waiting = c.get(f"{API}/conversations/{gid}", headers=me).json()["join_requests"]
        check("admin sees the request", len(waiting) == 1 and waiting[0]["user"]["id"] == ids["kenji"], waiting)
        r = c.post(f"{API}/conversations/{gid}/requests/{ids['kenji']}", json={"approve": True}, headers=me)
        check("approve the request", any(m["user"]["id"] == ids["kenji"] and m["is_active"] for m in r.json()["members"]), r.text)
        r = c.patch(f"{API}/conversations/{gid}/link", json={"reset": True}, headers=me)
        check("reset gives a new token", r.json()["group_link"]["token"] != token)
        old = c.get(f"{API}/conversations/group-link/{token}", headers=priya)
        check("old link stops working", old.status_code == 404, old.status_code)
        events = [
            m["body"]
            for m in c.get(f"{API}/conversations/{gid}/messages?limit=100", headers=me).json()["messages"]
            if m["type"] == "system"
        ]
        check(
            "link events in Signal's words",
            "turned on the group link with admin approval disabled." in events
            and "enabled admin approval for the group link." in events,
            events,
        )

        # --- mute --------------------------------------------------------------
        r = c.patch(f"{API}/conversations/{gid}/prefs", json={"muted_until": "2099-01-01T00:00:00Z"}, headers=me)
        check("mute", r.json()["is_muted"] is True)
        r = c.patch(f"{API}/conversations/{gid}/prefs", json={"muted_until": None}, headers=me)
        check("unmute with an explicit null", r.json()["is_muted"] is False, r.json())

        # --- disappearing messages -------------------------------------------
        direct = next(x for x in c.get(f"{API}/conversations", headers=me).json() if x["title"] == "Aarav Mehta")
        r = c.patch(f"{API}/conversations/{direct['id']}", json={"disappearing_seconds": 3}, headers=me)
        check("set a timer on a direct chat", r.json()["disappearing_seconds"] == 3)

        async def watch_expiry() -> tuple[bool, str | None]:
            async with websockets.connect(f"{WS}?token={aarav_token}") as socket:
                sent = c.post(
                    f"{API}/conversations/{direct['id']}/messages",
                    json={"client_id": f"vanish-{time.time()}", "body": "this will vanish"},
                    headers=me,
                ).json()
                deadline = time.time() + 12
                while time.time() < deadline:
                    try:
                        frame = json.loads(await asyncio.wait_for(socket.recv(), timeout=1))
                    except asyncio.TimeoutError:
                        continue
                    if frame.get("type") == "message.expired" and sent["id"] in frame.get("message_ids", []):
                        return True, sent["id"]
                return False, sent["id"]

        heard, vanished_id = asyncio.run(watch_expiry())
        check("a live 'expired' frame arrives", heard)
        page = c.get(f"{API}/conversations/{direct['id']}/messages", headers=aarav).json()["messages"]
        check("the message is gone from the server", all(m["id"] != vanished_id for m in page))
        found = c.get(f"{API}/messages/search", params={"q": "vanish"}, headers=me).json()
        check("and from search", not found, found)
        c.patch(f"{API}/conversations/{direct['id']}", json={"disappearing_seconds": 0}, headers=me)

        # --- clear chat, end group -------------------------------------------
        r = c.post(f"{API}/conversations/{gid}/clear", headers=aarav)
        mine_now = c.get(f"{API}/conversations/{gid}/messages", headers=aarav).json()["messages"]
        theirs = c.get(f"{API}/conversations/{gid}/messages", headers=me).json()["messages"]
        check("delete chat clears only my copy", not mine_now and theirs, (len(mine_now), len(theirs)))
        r = c.post(f"{API}/conversations/{gid}/end", headers=aarav)
        check("only an admin can end the group", r.status_code == 403, r.status_code)
        r = c.post(f"{API}/conversations/{gid}/end", headers=me)
        check("end the group", r.status_code == 200 and r.json()["ended_at"], r.text)
        r = c.post(f"{API}/conversations/{gid}/messages", json={"client_id": "after-end", "body": "x"}, headers=me)
        check("nobody can send to an ended group", r.status_code == 409, r.status_code)

    print(f"\n{len(failures)} failures" if failures else "\nAll checks passed.")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
