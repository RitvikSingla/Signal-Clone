"""Checks for profile photos, contacts and blocking.

Run with the API on :8000 and a seeded database:

    python scripts/profile_test.py
"""

from __future__ import annotations

import io
import sys

import httpx
from PIL import Image

API = "http://localhost:8000/api/v1"
failures: list[str] = []


def check(label: str, ok: bool, detail: object = "") -> None:
    print(("  ok    " if ok else "  FAIL  ") + label + (f"  ({detail})" if not ok else ""))
    if not ok:
        failures.append(label)


def login(c: httpx.Client, phone: str) -> dict:
    c.post(f"{API}/auth/request-code", json={"phone_number": phone})
    token = c.post(f"{API}/auth/verify", json={"phone_number": phone, "code": "123456"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def upload_png(c: httpx.Client, headers: dict) -> dict:
    buffer = io.BytesIO()
    Image.new("RGB", (200, 200), (200, 80, 80)).save(buffer, "PNG")
    return c.post(f"{API}/attachments", files={"file": ("me.png", buffer.getvalue(), "image/png")}, headers=headers).json()


def main() -> None:
    with httpx.Client(timeout=20) as c:
        me = login(c, "+919812345601")  # Ritvik
        aarav = login(c, "+919812345602")
        lucas = login(c, "+5511912345608")
        ids = {n: c.get(f"{API}/auth/me", headers=h).json()["id"] for n, h in (("me", me), ("aarav", aarav), ("lucas", lucas))}

        # --- profile photo ----------------------------------------------------
        mine = upload_png(c, me)
        r = c.patch(f"{API}/users/me", json={"avatar_url": mine["url"]}, headers=me)
        check("set my photo from my own upload", r.status_code == 200 and r.json()["avatar_url"] == mine["url"], r.text)
        seen = c.get(f"{API}/users/search", params={"q": "ritvik"}, headers=aarav).json()
        check("others see the photo", any(u["avatar_url"] == mine["url"] for u in seen), seen)
        r = c.patch(f"{API}/users/me", json={"avatar_url": "https://evil.example/track.png"}, headers=me)
        check("an outside URL is refused", r.status_code == 400, r.status_code)
        theirs = upload_png(c, aarav)
        r = c.patch(f"{API}/users/me", json={"avatar_url": theirs["url"]}, headers=me)
        check("someone else's upload is refused", r.status_code == 400, r.status_code)
        r = c.patch(f"{API}/users/me", json={"avatar_url": "/media/../signal.db"}, headers=me)
        check("a path escape is refused", r.status_code == 400, r.status_code)
        r = c.patch(f"{API}/users/me", json={"avatar_url": ""}, headers=me)
        check("an empty value removes the photo", r.json()["avatar_url"] is None, r.json())

        # --- group photo uses the same rule ----------------------------------
        r = c.post(f"{API}/conversations/group", json={"name": "Pics", "avatar_url": "https://evil.example/x.png"}, headers=me)
        check("group photo must be your own upload", r.status_code == 400, r.status_code)
        r = c.post(f"{API}/conversations/group", json={"name": "Pics", "avatar_url": mine["url"]}, headers=me)
        check("group created with your photo", r.status_code == 201 and r.json()["avatar_url"] == mine["url"], r.text)

        # --- contacts ---------------------------------------------------------
        before = {x["user"]["id"] for x in c.get(f"{API}/contacts", headers=me).json()}
        check("Lucas is not a contact yet", ids["lucas"] not in before)
        r = c.post(f"{API}/contacts", json={"user_id": ids["lucas"]}, headers=me)
        check("add a contact", r.status_code == 201, r.text)
        contact_id = r.json()["id"]
        r = c.post(f"{API}/contacts", json={"handle": "@lucas"}, headers=me)
        check("adding twice is refused", r.status_code == 409, r.status_code)
        r = c.delete(f"{API}/contacts/{contact_id}", headers=me)
        after = {x["user"]["id"] for x in c.get(f"{API}/contacts", headers=me).json()}
        check("remove a contact", r.status_code == 200 and ids["lucas"] not in after, r.text)

        # --- blocking ----------------------------------------------------------
        direct = c.post(f"{API}/conversations/direct", json={"peer_id": ids["aarav"]}, headers=me).json()
        aarav_contact = next(x for x in c.get(f"{API}/contacts", headers=me).json() if x["user"]["id"] == ids["aarav"])
        c.patch(f"{API}/contacts/{aarav_contact['id']}", json={"is_blocked": True}, headers=me)
        r = c.post(f"{API}/conversations/{direct['id']}/messages", json={"client_id": "blk-1", "body": "hi"}, headers=aarav)
        check("a blocked person cannot message you", r.status_code == 403, r.status_code)
        check("and is not told they are blocked", "blocked" not in r.text.lower(), r.text)
        r = c.post(f"{API}/conversations/{direct['id']}/messages", json={"client_id": "blk-2", "body": "hi"}, headers=me)
        check("you cannot message someone you blocked", r.status_code == 409, r.status_code)
        c.patch(f"{API}/contacts/{aarav_contact['id']}", json={"is_blocked": False}, headers=me)
        r = c.post(f"{API}/conversations/{direct['id']}/messages", json={"client_id": "blk-3", "body": "hi again"}, headers=aarav)
        check("after unblocking, messages flow again", r.status_code == 201, r.status_code)

    print(f"\n{len(failures)} failures" if failures else "\nAll checks passed.")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
