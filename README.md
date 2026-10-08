# Signal Clone

A secure-messaging platform that reproduces Signal's layout, conversation model
and real-time behaviour. Built for the Scaler SDE Fullstack assignment.

Encryption is **simulated**, as the brief permits. Everything else is real:
messages persist, receipts are tracked per recipient, and delivery happens over
a live WebSocket rather than a poll.

---

## Status

Phase 0 of 12 complete. See `docs/PLAN.md` for the full build sequence.

| Phase | Area | State |
| ----- | ---- | ----- |
| 00 | Scaffold | Done |
| 01 | Data layer | Not started |
| 02 | Authentication | Not started |
| 03 | Conversations and messages | Not started |
| 04 | Realtime hub | Not started |
| 05 | Frontend shell | Not started |
| 06 | Onboarding | Not started |
| 07 | Conversation list | Not started |
| 08 | Chat pane | Not started |
| 09 | Groups | Not started |
| 10 | Signal surface | Not started |
| 11 | Bonus features | Not started |
| 12 | Documentation and deploy | Not started |

---

## Tech stack

| Layer | Choice | Why |
| ----- | ------ | --- |
| Frontend | Next.js 15, TypeScript, Tailwind v4 | App Router, server components for the shell, client components for the live thread |
| Backend | FastAPI, SQLAlchemy 2.0, Alembic | Native WebSocket support with no extra broker, async ORM, migrations as reviewable history |
| Database | SQLite with WAL and FTS5 | Named by the brief. FTS5 gives message search without another service |
| Realtime | Native WebSocket, JWT handshake | One socket per tab, keyed by account, so several tabs behave like several devices |
| Auth | JWT access plus rotating refresh | Access token in memory, refresh token server-side and revocable |

---

## Repository layout

```
signal-clone/
├── backend/
│   ├── app/
│   │   ├── api/v1/      routers, one module per feature area
│   │   ├── core/        settings, security, shared dependencies
│   │   ├── db/          engine, session, base, seed script
│   │   ├── models/      SQLAlchemy tables
│   │   ├── schemas/     Pydantic request and response models
│   │   ├── services/    business rules, kept out of the routers
│   │   ├── realtime/    connection hub and event definitions
│   │   └── main.py      application factory
│   ├── tests/
│   ├── media/           uploaded files, gitignored
│   └── requirements.txt
└── frontend/
    └── src/
        ├── app/         App Router pages
        ├── components/  UI, one file per component
        ├── hooks/       useSocket, useConversation, useTyping
        ├── lib/         API client and shared types
        └── store/       Zustand slices
```

---

## Setup

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS and Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API is then on `http://localhost:8000`, with interactive docs at
`http://localhost:8000/docs`. No `.env` file is required for local work;
copy `.env.example` to `.env` only when you need to override something.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app is then on `http://localhost:3000`.

---

## Database schema

Eleven tables. Full column-level detail lands in Phase 1.

| Table | Holds |
| ----- | ----- |
| `users` | One row per account: identity, profile, presence |
| `devices` | Backs the Linked Devices screen |
| `contacts` | Directed address book, a self-join on users |
| `conversations` | One object for both direct and group threads |
| `conversation_members` | Membership, role, read cursor, per-person preferences |
| `messages` | The thread. Soft deleted, never hard deleted |
| `message_receipts` | Per-recipient delivery and read truth |
| `reactions` | One emoji per person per message |
| `attachments` | Files and images hung off a message |
| `auth_sessions` | Refresh token store, makes logout real |
| `phone_verifications` | The mocked OTP flow, modelled as if it were real |

Three decisions drive the shape:

1. A conversation is the **same object** whether it holds two people or twenty.
   A `type` column distinguishes them, and a sorted-pair `dm_key` enforces one
   direct thread per pair.
2. Read state belongs to the **membership**, not the message. Unread counts are
   derived from a cursor rather than stored and kept in sync.
3. A receipt is **per recipient**, because a group message is delivered many
   times. The sender's check marks roll those up.

---

## API overview

REST under `/api/v1` for anything that must survive a refresh. One WebSocket at
`/ws` for anything that must arrive within a frame.

| Area | Endpoints |
| ---- | --------- |
| Meta | `GET /health`, `GET /api/v1/ping` |
| Auth | Phase 2 |
| Contacts | Phase 3 |
| Conversations | Phase 3 |
| Messages | Phase 3 |

---

## Assumptions

- Phone verification is mocked with a fixed code. In development the code is
  returned in the response body so a reviewer never has to guess it.
- Encryption is simulated. Each account carries a random identity key and
  registration id, messages carry a derived envelope hash, and the safety-number
  screen is built from both parties' keys. There is no real key agreement.
- Online and last-seen state is driven by actual socket connect and disconnect,
  not by a random generator.
- Message bodies are stored as plaintext. The simulation does not pretend
  otherwise at rest, and the README says so rather than implying real E2EE.

---

## Licence and originality

Written from scratch for this assignment. No existing Signal clone repository
was used as a source. The official Signal clients are GPL-licensed, so no code
was taken from them either.
