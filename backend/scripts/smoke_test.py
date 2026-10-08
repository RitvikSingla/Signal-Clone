"""End-to-end exercise of the Phase 3 API against a running server."""

import json
import subprocess

BASE = "http://127.0.0.1:8000/api/v1"
FAILURES = []


def curl(method, path, token=None, body=None):
    cmd = ["curl", "-s", "-w", "\n%{http_code}", "-X", method, BASE + path]
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


def login(phone):
    curl("POST", "/auth/request-code", body={"phone_number": phone})
    code, data = curl("POST", "/auth/verify", body={"phone_number": phone, "code": "123456"})
    assert code == 200, (code, data)
    return data["access_token"]


def ok(label, cond, extra=""):
    if cond:
        print("  PASS  " + label)
    else:
        FAILURES.append(label)
        print("  FAIL  " + label + "  -> " + str(extra))


ritvik = login("+919812345601")
aarav = login("+919812345602")
sofia = login("+393401234505")

print("\n--- conversation list ---")
code, convs = curl("GET", "/conversations", ritvik)
ok("list returns 200", code == 200, convs)
ok("six threads for Ritvik", len(convs) == 6, len(convs))
ok("pinned thread sorts first", convs[0]["is_pinned"] is True, convs[0]["title"])
ok("direct thread borrows the peer name",
   any(c["type"] == "direct" and c["title"] == "Aarav Mehta" for c in convs))
ok("unread counts present", sum(c["unread_count"] for c in convs) > 0)
print("    ", [(c["title"], c["unread_count"], c["my_role"]) for c in convs])

code, unread = curl("GET", "/conversations?unread_only=true", ritvik)
ok("unread filter narrows the list", 0 < len(unread) < len(convs), (len(unread), len(convs)))

code, found = curl("GET", "/conversations?search=priya", ritvik)
ok("title search works", len(found) == 1 and found[0]["title"] == "Priya Nair", found)

print("\n--- thread paging ---")
dm = next(c for c in convs if c["title"] == "Aarav Mehta")
code, page = curl("GET", "/conversations/%s/messages?limit=10" % dm["id"], ritvik)
ok("page returns ten", len(page["messages"]) == 10, len(page["messages"]))
ok("has_more is true", page["has_more"] is True)
ok("oldest first inside the page",
   page["messages"][0]["created_at"] < page["messages"][-1]["created_at"])
code, page2 = curl(
    "GET", "/conversations/%s/messages?limit=10&before=%s" % (dm["id"], page["next_before"]), ritvik
)
ok("cursor page is older", page2["messages"][-1]["created_at"] <= page["messages"][0]["created_at"])
ok("pages do not overlap",
   not ({m["id"] for m in page["messages"]} & {m["id"] for m in page2["messages"]}))

print("\n--- send and idempotency ---")
code, m1 = curl("POST", "/conversations/%s/messages" % dm["id"], ritvik,
                {"client_id": "test-abc-1", "body": "Testing the send path."})
ok("send returns 201", code == 201, (code, m1))
ok("status starts at sent", m1["status"] == "sent", m1["status"])
code, m2 = curl("POST", "/conversations/%s/messages" % dm["id"], ritvik,
                {"client_id": "test-abc-1", "body": "Testing the send path."})
ok("retry returns 200 rather than 201", code == 200, code)
ok("retry returns the same row", m1["id"] == m2["id"])
code, _ = curl("POST", "/conversations/%s/messages" % dm["id"], ritvik,
               {"client_id": "x", "body": "   "})
ok("empty message rejected", code == 422, code)

print("\n--- receipts and status rollup ---")
code, aconvs = curl("GET", "/conversations", aarav)
adm = next(c for c in aconvs if c["title"] == "Ritvik Singla")
code, _ = curl("POST", "/conversations/%s/read" % adm["id"], aarav, {"last_message_id": None})
ok("mark read returns 200", code == 200, code)
code, after = curl("GET", "/conversations/%s/messages?limit=3" % dm["id"], ritvik)
found_msg = [m for m in after["messages"] if m["id"] == m1["id"]]
ok("sender bubble promoted to read",
   bool(found_msg) and found_msg[0]["status"] == "read",
   found_msg[0]["status"] if found_msg else "not on this page")
code, aconvs2 = curl("GET", "/conversations", aarav)
adm2 = next(c for c in aconvs2 if c["title"] == "Ritvik Singla")
ok("reader unread cleared", adm2["unread_count"] == 0, adm2["unread_count"])

print("\n--- edit, delete, react ---")
code, edited = curl("PATCH", "/messages/%s" % m1["id"], ritvik, {"body": "Edited text."})
ok("edit stamps edited_at", edited["edited_at"] is not None, edited)
code, _ = curl("PATCH", "/messages/%s" % m1["id"], aarav, {"body": "not mine"})
ok("cannot edit someone else's message", code == 403, code)
code, reacted = curl("PUT", "/messages/%s/reaction" % m1["id"], aarav, {"emoji": "\U0001F44D"})
ok("reaction added", len(reacted["reactions"]) == 1, reacted["reactions"])
code, toggled = curl("PUT", "/messages/%s/reaction" % m1["id"], aarav, {"emoji": "\U0001F44D"})
ok("same emoji twice clears it", len(toggled["reactions"]) == 0, toggled["reactions"])
code, deleted = curl("DELETE", "/messages/%s" % m1["id"], ritvik)
ok("soft delete withholds the body",
   deleted["body"] is None and deleted["deleted_at"] is not None, deleted)

print("\n--- access control ---")
code, _ = curl("GET", "/conversations/%s" % dm["id"], sofia)
ok("non-member gets 404, not 403", code == 404, code)
code, _ = curl("GET", "/conversations/%s/messages" % dm["id"], sofia)
ok("non-member cannot read the thread", code == 404, code)
code, _ = curl("GET", "/conversations", None)
ok("no token is 401", code == 401, code)

print("\n--- group admin rules ---")
design = next(c for c in convs if c["title"] == "Design Review")
ok("Ritvik is a plain member of Design Review", design["my_role"] == "member", design["my_role"])
code, refused = curl("POST", "/conversations/%s/members" % design["id"], ritvik,
                     {"user_ids": ["anything"]})
ok("non-admin add is refused by the server", code == 403, (code, refused))
trek = next(c for c in convs if c["title"] == "Weekend Trek")
ok("Ritvik is admin of Weekend Trek", trek["my_role"] == "admin", trek["my_role"])
code, detail = curl("GET", "/conversations/%s" % trek["id"], ritvik)
ok("group detail lists four members", len(detail["members"]) == 4, len(detail["members"]))
ok("admin sorts first in the member list", detail["members"][0]["role"] == "admin")

print("\n--- creating threads ---")
code, hits = curl("GET", "/users/search?q=kenji", ritvik)
kenji_id = hits[0]["id"]
code, newgroup = curl("POST", "/conversations/group", ritvik,
                      {"name": "API Test Group", "member_ids": [kenji_id]})
ok("group created", code == 201, (code, newgroup))
ok("creator becomes admin", newgroup["my_role"] == "admin", newgroup["my_role"])
ok("system message written on create",
   newgroup["last_message"]["type"] == "system", newgroup["last_message"])
code, d1 = curl("POST", "/conversations/direct", ritvik, {"peer_id": kenji_id})
ok("new direct thread created", code == 201, code)
code, d2 = curl("POST", "/conversations/direct", ritvik, {"peer_id": kenji_id})
ok("second call reuses the same thread", code == 200 and d1["id"] == d2["id"], code)
code, _ = curl("POST", "/conversations/direct", ritvik, {"peer_id": "does-not-exist"})
ok("unknown peer rejected", code == 404, code)

print("\n--- group membership changes ---")
code, with_member = curl("POST", "/conversations/%s/members" % trek["id"], ritvik,
                         {"user_ids": [kenji_id]})
ok("admin can add a member", code == 200 and len(with_member["members"]) == 5,
   len(with_member["members"]) if code == 200 else code)
code, promoted = curl("PATCH", "/conversations/%s/members/%s" % (trek["id"], kenji_id),
                      ritvik, {"role": "admin"})
ok("admin can promote", code == 200, code)
code, removed = curl("DELETE", "/conversations/%s/members/%s" % (trek["id"], kenji_id), ritvik)
active = [m for m in removed["members"] if m["is_active"]] if code == 200 else []
ok("admin can remove, leaving four active", code == 200 and len(active) == 4,
   len(active) if code == 200 else code)

print("\n--- search ---")
code, hits = curl("GET", "/messages/search?q=stove", ritvik)
ok("full-text search returns hits", len(hits) >= 4, len(hits))
ok("hits carry a thread title", all(h["conversation_title"] for h in hits))
code, nohits = curl("GET", "/messages/search?q=zzzznotathing", ritvik)
ok("no false positives", len(nohits) == 0, len(nohits))
code, scoped = curl("GET", "/messages/search?q=stove", sofia)
ok("search is scoped to my own threads", len(scoped) == 0, len(scoped))

print("\n--- contacts and safety number ---")
code, contacts = curl("GET", "/contacts", ritvik)
ok("contacts listed", len(contacts) == 6, len(contacts))
code, sn = curl("GET", "/users/%s/safety-number" % kenji_id, ritvik)
ok("safety number is sixty digits",
   len(sn["safety_number"].replace(" ", "")) == 60, sn.get("safety_number", "")[:24])

print("\n==================================")
if FAILURES:
    print("%d FAILED:" % len(FAILURES))
    for f in FAILURES:
        print("   -", f)
else:
    print("All checks passed.")
