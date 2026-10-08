# Build sequence

Thirteen phases, roughly 24 hours. Ordered so the product becomes demonstrable
early and stays that way. The backend leads, because a typed client generated
from a settled schema removes a whole class of rework.

Every phase carries a **gate**. If the gate does not pass, the next phase does
not start.

---

## Phase 00 — Scaffold · 0.5h · done

- Repository with `backend/` and `frontend/` side by side, plus a README.
- FastAPI app with a health route, CORS, and settings loaded from environment.
- Next.js with TypeScript, Tailwind v4, ESLint and Prettier.

**Gate:** both dev servers start, and the browser reaches the health route
through the API client.

---

## Phase 01 — Data layer · 3h

- All eleven SQLAlchemy models with relationships and constraints.
- Initial Alembic migration, reviewed rather than blindly generated.
- FTS5 virtual table and its sync triggers.
- Seed script producing eight accounts, five direct threads, three groups and
  roughly two hundred backdated messages.

**Gate:** the seed runs on a fresh database file and a SQL client shows
populated threads with sensible timestamps.

---

## Phase 02 — Authentication · 2h

- Verification request and verify endpoints over the mocked code.
- Access and refresh issuance, rotation, and the session table.
- Current-user dependency, plus a 401 path the client can act on.

**Gate:** a full signup and a returning sign-in both work from an HTTP client,
and refresh survives an expired access token.

---

## Phase 03 — Conversations and messages · 3h

- Conversation create for direct and group, with the pair-uniqueness rule.
- Thread listing with unread counts, last message and presence.
- Cursor-paged message fetch, send with idempotency, edit, soft delete.
- Read cursor endpoint and the receipt rows behind it.
- Member add, remove and role change, guarded by the admin check.

**Gate:** every core endpoint is exercised from the OpenAPI page and the rows
look right in the database.

---

## Phase 04 — Realtime hub · 2h

- Socket endpoint with token handshake and a per-account connection registry.
- Fan-out on send, status promotion on delivery and read.
- Typing and presence relay, with presence written back to the user row.
- Heartbeat, reconnect, and replay-by-cursor on resume.

**Gate:** two browser tabs on different accounts exchange messages with no
refresh, and a dropped socket recovers on its own.

---

## Phase 05 — Frontend shell · 2h

- Design tokens into the Tailwind theme, both themes at once.
- Nav rail, resizable list pane and chat pane, with the responsive collapse.
- Typed API client and types generated from the OpenAPI document.
- Toast system and the app-wide empty state.

**Gate:** the shell matches a Signal screenshot side by side at desktop and
phone widths.

---

## Phase 06 — Onboarding · 1.5h

- Phone entry, code entry, profile setup with avatar and colour picker.
- Session rehydration on load, and a sign-out that revokes server-side.
- Seeded demo accounts offered as one-tap sign-in.

**Gate:** a reviewer reaches the chat list from a cold browser in under fifteen
seconds.

---

## Phase 07 — Conversation list · 2h

- Rows with avatar, name, preview, timestamp and unread pill.
- Search across conversations, contacts and message bodies.
- Unread filter, pin, mute, archive.
- New chat and new group modals, add contact sheet.

**Gate:** the list reorders live when a message lands in a thread that is not
open.

---

## Phase 08 — Chat pane · 3h

- Bubbles with grouping, tails, date dividers and system messages.
- Optimistic send reconciling on client id, with a retry affordance on failure.
- Check-mark states driven by real receipts, not timers.
- Typing indicator, presence line, scroll anchoring, jump to latest.
- Infinite upward paging on the cursor.

**Gate:** all four message statuses are observable in a two-tab demo, and
nothing duplicates on a flaky send.

---

## Phase 09 — Groups · 1.5h

- Creation flow: member picker, then name and avatar.
- Group info panel listing members with role badges.
- Admin controls for add, remove, promote, demote.
- System messages rendered for every membership change.

**Gate:** a non-admin sees the controls absent, and the server refuses the call
if they forge it anyway.

---

## Phase 10 — Signal surface · 1h

- Settings screens for privacy, notifications and appearance.
- Coming Soon placeholders for calls, stories and linked devices.
- Safety-number screen and the encryption notice in the thread header.
- Keyboard shortcuts and a shortcut reference sheet.

**Gate:** every navigation target resolves to a real screen, with no dead links.

---

## Phase 11 — Bonus · 1.5h

- Emoji reactions with the hover bar and reaction pills.
- Reply-to with the quoted strip and tap-to-scroll.
- Image and file attachments with thumbnails.
- Disappearing messages, swept server-side rather than hidden in the client.
- Dark mode toggle wired to the token set.

**Gate:** each bonus item either works end to end or is removed. Nothing ships
half-wired.

---

## Phase 12 — Documentation and deploy · 1h

- README with setup, architecture, schema, API overview and assumptions.
- Backend on Render with a persistent disk, seed run once.
- Frontend on Vercel pointed at the deployed API, with secure sockets.
- Smoke test on the live URL from two devices.

**Gate:** a stranger can follow the README from clone to running locally, and
the hosted link works from a phone.

---

## Known risks

**SQLite on a free host is not durable.** Render's free tier has an ephemeral
filesystem, so the database resets on redeploy. Either attach a persistent disk
on the paid starter tier, or accept the reset and re-seed on boot. Whichever we
pick gets stated in the README.

**Vercel cannot hold a WebSocket.** Serverless functions time out, so the socket
terminates on the backend service. The frontend therefore talks to two origins,
which makes CORS and secure-socket configuration load-bearing.

**Group check marks roll up many receipts.** Delivered means every active member
has a delivery row; read means every active member has a read row. Worth stating
explicitly, because a reviewer will ask.

**Pixel fidelity has no upper bound.** The brief asks for an exact match, which
is unachievable in the budget. Layout, spacing, colour and interaction behaviour
get matched; small iconography differences are accepted. Phase 5 includes an
explicit side-by-side comparison so the gap is measured rather than guessed.
