"""Seed the database with a demo dataset.

Run with:

    python -m app.db.seed            # refuses if data already exists
    python -m app.db.seed --force    # wipes and reseeds

The brief asks for seeded data so the app is usable the moment it opens. This
script produces eight accounts, a contact graph, five direct threads and three
groups, with scripted conversations backdated across ten days, mixed read
state, reactions, quoted replies, one group where the demo account is a plain
member rather than an admin, and one thread with a disappearing timer running.

Everything is deterministic: the random seed is fixed, so two runs produce the
same demo and a screenshot stays accurate.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models import (
    Attachment,
    AuthSession,
    Contact,
    Conversation,
    ConversationMember,
    ConversationType,
    Device,
    DevicePlatform,
    MemberRole,
    Message,
    MessageReceipt,
    MessageStatus,
    MessageType,
    PhoneVerification,
    Reaction,
    User,
    build_dm_key,
)

RANDOM_SEED = 20261008
NOW = datetime.now(timezone.utc).replace(microsecond=0)


# ---------------------------------------------------------------------------
# People
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class SeedUser:
    key: str
    display_name: str
    phone_number: str
    username: str
    about: str
    avatar_color: str


SEED_USERS: tuple[SeedUser, ...] = (
    SeedUser("ritvik", "Ritvik Singla", "+919812345601", "ritvik",
             "Building things that work offline.", "A210"),
    SeedUser("aarav", "Aarav Mehta", "+919812345602", "aarav",
             "Trail runner. Backend by day.", "A140"),
    SeedUser("priya", "Priya Nair", "+919812345603", "priyan",
             "Design systems and strong coffee.", "A180"),
    SeedUser("daniel", "Daniel Okafor", "+447700900104", "danok",
             "Security research. Ask me about keys.", "A160"),
    SeedUser("sofia", "Sofia Rossi", "+393401234505", "sofia.r",
             "Typography is interface design.", "A110"),
    SeedUser("kenji", "Kenji Tanaka", "+819012345606", "kenji",
             "Latency is a feature.", "A150"),
    SeedUser("amara", "Amara Osei", "+233201234507", "amara",
             "Weekend baker.", "A130"),
    SeedUser("lucas", "Lucas Silva", "+5511912345608", "lucas",
             "", "A120"),
)

DEVICES: tuple[tuple[str, str, DevicePlatform, bool], ...] = (
    ("ritvik", "Chrome on Windows", DevicePlatform.DESKTOP, True),
    ("ritvik", "Pixel 8", DevicePlatform.ANDROID, False),
    ("aarav", "iPhone 15", DevicePlatform.IOS, True),
    ("priya", "MacBook Pro", DevicePlatform.DESKTOP, True),
    ("priya", "iPhone 14", DevicePlatform.IOS, False),
    ("daniel", "Firefox on Linux", DevicePlatform.DESKTOP, True),
    ("sofia", "iPhone 13", DevicePlatform.IOS, True),
    ("kenji", "Pixel 7", DevicePlatform.ANDROID, True),
    ("amara", "Samsung S23", DevicePlatform.ANDROID, True),
    ("lucas", "iPhone SE", DevicePlatform.IOS, True),
)

# Directed address book. Each pair is (owner, contact).
CONTACT_EDGES: tuple[tuple[str, str], ...] = (
    ("ritvik", "aarav"), ("ritvik", "priya"), ("ritvik", "daniel"),
    ("ritvik", "sofia"), ("ritvik", "kenji"), ("ritvik", "amara"),
    ("aarav", "ritvik"), ("aarav", "priya"), ("aarav", "daniel"),
    ("priya", "ritvik"), ("priya", "aarav"), ("priya", "sofia"),
    ("priya", "kenji"),
    ("daniel", "ritvik"), ("daniel", "aarav"),
    ("sofia", "priya"), ("sofia", "kenji"), ("sofia", "ritvik"),
    ("kenji", "sofia"), ("kenji", "priya"),
    ("amara", "ritvik"), ("amara", "lucas"),
    ("lucas", "amara"),
)

# ---------------------------------------------------------------------------
# Scripted conversations
#
# Each line is (sender_key, text) or ("*", text) for a system message. An
# optional third element carries extras:
#   {"reply": -2}                 quote the message two positions back
#   {"react": [("priya", "heart")]}  reactions, by user key and emoji
# ---------------------------------------------------------------------------

Line = tuple

DIRECT_THREADS: tuple[dict, ...] = (
    {
        "pair": ("ritvik", "aarav"),
        "minutes_ago_end": 4,
        "unread_for": ("ritvik",),
        "unread_count": 2,
        "lines": (
            ("aarav", "Are we still on for Saturday?"),
            ("ritvik", "Yes. Leaving at 5am so we beat the heat."),
            ("aarav", "5am is aggressive but fine."),
            ("ritvik", "It is a four hour climb. Trust me."),
            ("aarav", "Did you book the permits?"),
            ("ritvik", "Done this morning. Four of us."),
            ("aarav", "Who else is coming?"),
            ("ritvik", "Priya and Daniel."),
            ("aarav", "Good, Daniel always brings the extra water."),
            ("ritvik", "He brings the extra everything."),
            ("aarav", "What is the weather looking like?"),
            ("ritvik", "Clear until noon, then a chance of rain."),
            ("aarav", "So we summit early or we get soaked."),
            ("ritvik", "That is the plan."),
            ("aarav", "I will bring the stove."),
            ("ritvik", "Bring the small one, not the one from last time.",
             {"react": [("aarav", "\U0001F602")]}),
            ("aarav", "That stove was fine."),
            ("ritvik", "It took forty minutes to boil water."),
            ("aarav", "Forty five. Let us be accurate."),
            ("ritvik", "Small stove. Please."),
            ("aarav", "Small stove."),
            ("ritvik", "Also, can you grab batteries for the headlamps?"),
            ("aarav", "How many?"),
            ("ritvik", "Eight AAA."),
            ("aarav", "Picking them up tonight."),
            ("aarav", "One more thing, is the trailhead parking free?"),
            ("aarav", "Asking because last time it was two hundred."),
        ),
    },
    {
        "pair": ("ritvik", "priya"),
        "minutes_ago_end": 55,
        "unread_for": (),
        "unread_count": 0,
        "lines": (
            ("priya", "I pushed the token file. Have a look when you can."),
            ("ritvik", "Looking now."),
            ("ritvik", "The naming is much clearer than the last pass."),
            ("priya", "I dropped the shade numbers. They were meaningless."),
            ("ritvik", "Agreed. surface and surface-raised read fine."),
            ("priya", "Dark theme is the same token names, different values."),
            ("ritvik", "That is the whole point of doing it this way."),
            ("priya", "One question. Do we need a separate border-strong?"),
            ("ritvik", "Yes, for the resize handle and the scrollbar."),
            ("priya", "Fair."),
            ("ritvik", "What about the avatar colours?"),
            ("priya", "Twelve of them, keyed off the account id."),
            ("ritvik", "So the same person is always the same colour."),
            ("priya", "Exactly. It is how you recognise a row at a glance.",
             {"react": [("ritvik", "\U0001F44D")]}),
            ("ritvik", "I will wire them into the Avatar component."),
            ("priya", "Do not forget the initials fallback."),
            ("ritvik", "First letter of each word, max two."),
            ("priya", "Perfect."),
            ("priya", "Ship it."),
        ),
    },
    {
        "pair": ("ritvik", "daniel"),
        "minutes_ago_end": 190,
        "disappearing_seconds": 86400,
        "unread_for": ("ritvik",),
        "unread_count": 1,
        "lines": (
            ("*", "Daniel Okafor set disappearing messages to 1 day."),
            ("daniel", "Turning the timer on for this thread."),
            ("ritvik", "Any particular reason?"),
            ("daniel", "Habit, mostly. It is a good default."),
            ("ritvik", "Fine by me."),
            ("daniel", "Did you look at the key exchange section?"),
            ("ritvik", "I did. We are mocking it, so no X3DH."),
            ("daniel", "Make sure the README says that plainly."),
            ("ritvik", "It does. No key agreement, no ratchet."),
            ("daniel", "Good. Half the clones out there imply otherwise."),
            ("ritvik", "The safety number screen is still there though."),
            ("daniel", "Built from both identity keys?"),
            ("ritvik", "Yes, just not from a real exchange."),
            ("daniel", "That is the honest version. I like it."),
            ("daniel", "Send me the doc when it is ready."),
        ),
    },
    {
        "pair": ("aarav", "priya"),
        "minutes_ago_end": 1500,
        "unread_for": (),
        "unread_count": 0,
        "lines": (
            ("priya", "Do you have the figma link for the list rows?"),
            ("aarav", "Ritvik has it. I only have the spec."),
            ("priya", "What does the spec say about row height?"),
            ("aarav", "Seventy two pixels."),
            ("priya", "And the avatar?"),
            ("aarav", "Forty eight."),
            ("priya", "That leaves twelve either side. Correct."),
            ("aarav", "Timestamps are eleven pixel."),
            ("priya", "Small but it matches the real app."),
            ("aarav", "Everything here matches the real app or it does not ship."),
            ("priya", "Noted."),
        ),
    },
    {
        "pair": ("sofia", "kenji"),
        "minutes_ago_end": 3100,
        "unread_for": (),
        "unread_count": 0,
        "lines": (
            ("kenji", "Did the latency numbers come back?"),
            ("sofia", "Yes. Median forty one milliseconds on the socket."),
            ("kenji", "That is well inside a frame."),
            ("sofia", "The slow part is the first paint, not the message."),
            ("kenji", "Server render or hydration?"),
            ("sofia", "Hydration. Too much state on the client."),
            ("kenji", "Move the shell to the server then."),
            ("sofia", "That is the plan for the next pass."),
            ("kenji", "Send me the trace."),
            ("sofia", "Tomorrow morning."),
        ),
    },
)


GROUP_THREADS: tuple[dict, ...] = (
    {
        "name": "Weekend Trek",
        "description": "Saturday, 5am, bring water.",
        "avatar_color": "A140",
        "admin": "ritvik",
        "members": ("ritvik", "aarav", "priya", "daniel"),
        "minutes_ago_end": 18,
        "unread_for": ("ritvik", "priya"),
        "unread_count": 3,
        "lines": (
            ("*", "Ritvik Singla created the group."),
            ("*", "Ritvik Singla added Aarav Mehta, Priya Nair and Daniel Okafor."),
            ("ritvik", "Saturday. 5am at the trailhead."),
            ("priya", "5am from where exactly?"),
            ("ritvik", "The north car park, not the visitor centre."),
            ("daniel", "The one with the broken gate?"),
            ("ritvik", "That is the one."),
            ("aarav", "I can take three people if someone wants a lift."),
            ("priya", "Yes please."),
            ("daniel", "Same."),
            ("aarav", "Done. I will be at Priya's at 4:15."),
            ("priya", "4:15 is brutal."),
            ("aarav", "You agreed to 5am at a trailhead an hour away."),
            ("priya", "I did not do the arithmetic.",
             {"react": [("daniel", "\U0001F602"), ("ritvik", "\U0001F602")]}),
            ("daniel", "Nobody ever does."),
            ("ritvik", "Packing list: two litres of water each, snacks, layers."),
            ("ritvik", "It is ten degrees at the top before sunrise."),
            ("daniel", "I am bringing the big flask."),
            ("aarav", "And the small stove. Apparently."),
            ("ritvik", "Thank you."),
            ("priya", "What about the descent? Same route?"),
            ("ritvik", "No, the ridge path. It is longer but easier on the knees."),
            ("daniel", "Good, last time my knees filed a complaint."),
            ("priya", "How long in total?"),
            ("ritvik", "Four up, three down, plus an hour at the top."),
            ("aarav", "So home by three."),
            ("ritvik", "If nobody oversleeps."),
            ("priya", "Looking at Aarav."),
            ("aarav", "That was once."),
            ("daniel", "Twice."),
            ("aarav", "Once with witnesses."),
            ("ritvik", "Set two alarms."),
            ("daniel", "Weather still looks clear until noon."),
            ("daniel", "I will post an update Friday night."),
            ("aarav", "See you all Saturday."),
        ),
    },
    {
        "name": "Design Review",
        "description": "Weekly. Bring screenshots, not opinions.",
        "avatar_color": "A180",
        # Priya is the admin here and Ritvik is a plain member, so the
        # permission paths are demonstrable from the demo account.
        "admin": "priya",
        "members": ("priya", "ritvik", "sofia", "kenji"),
        "minutes_ago_end": 340,
        "unread_for": ("ritvik",),
        "unread_count": 4,
        "lines": (
            ("*", "Priya Nair created the group."),
            ("*", "Priya Nair added Ritvik Singla, Sofia Rossi and Kenji Tanaka."),
            ("priya", "Agenda: bubbles, the composer, and the empty state."),
            ("sofia", "Starting with bubbles. The radius is wrong."),
            ("ritvik", "Wrong how?"),
            ("sofia", "Eighteen everywhere. It should collapse on the tail."),
            ("priya", "Four pixels on the corner nearest the previous bubble."),
            ("ritvik", "Only within a run from the same sender?"),
            ("sofia", "Yes. A new sender resets it."),
            ("ritvik", "Got it. That is a one line change in the grouping logic."),
            ("kenji", "While we are here, the timestamp placement is off."),
            ("sofia", "Inside the bubble, bottom right, same baseline as the ticks."),
            ("kenji", "And it only shows on the last message of a run."),
            ("priya", "Correct."),
            ("ritvik", "Noted both."),
            ("priya", "Composer next."),
            ("sofia", "The mic icon should become a send arrow once there is text."),
            ("kenji", "With no transition? It feels abrupt."),
            ("sofia", "There is a crossfade in the real app. Very short."),
            ("ritvik", "I will match it."),
            ("priya", "Empty state."),
            ("kenji", "Currently it says No conversation selected."),
            ("sofia", "The real one shows the app icon and a short line."),
            ("priya", "And nothing else. No call to action."),
            ("ritvik", "Less is the whole aesthetic here."),
            ("sofia", "Exactly."),
            ("priya", "Anything else before I close this out?"),
            ("kenji", "The scrollbar. Ours is the default width."),
            ("sofia", "Thin, and only visible over the list."),
            ("ritvik", "Adding it to the token file."),
            ("priya", "Good session. Same time next week."),
        ),
    },
    {
        "name": "Family",
        "description": None,
        "avatar_color": "A130",
        "admin": "amara",
        "members": ("amara", "lucas", "ritvik"),
        "minutes_ago_end": 2600,
        "unread_for": (),
        "unread_count": 0,
        "lines": (
            ("*", "Amara Osei created the group."),
            ("*", "Amara Osei added Lucas Silva and Ritvik Singla."),
            ("amara", "Sunday lunch at one. Everyone free?"),
            ("lucas", "Yes."),
            ("ritvik", "I am trekking Saturday so I will be slow, but yes."),
            ("amara", "Slow is fine. Just come."),
            ("lucas", "Should I bring anything?"),
            ("amara", "Bread. The good kind."),
            ("lucas", "The bakery on the corner?"),
            ("amara", "That one."),
            ("ritvik", "I will bring dessert."),
            ("amara", "Not the shop one."),
            ("ritvik", "I will make something.",
             {"react": [("amara", "❤️")]}),
            ("lucas", "This I have to see."),
            ("ritvik", "I can bake."),
            ("lucas", "Evidence?"),
            ("ritvik", "Sunday."),
            ("amara", "Sunday then. One o'clock."),
        ),
    },
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def envelope_hash(body: str | None, message_id: str) -> str:
    """Simulated envelope digest.

    Shown on the message-info sheet. It is a plain digest of the body and the
    message id: it proves nothing and protects nothing, it only gives the UI
    something stable and per-message to display.
    """
    payload = f"{message_id}:{body or ''}".encode()
    return hashlib.sha256(payload).hexdigest()[:32]


def fake_identity_key(rng: random.Random) -> str:
    return "".join(rng.choice("0123456789abcdef") for _ in range(64))


async def wipe(db: AsyncSession) -> None:
    """Delete in foreign-key-safe order."""
    for model in (
        Reaction,
        MessageReceipt,
        Attachment,
        Message,
        ConversationMember,
        Conversation,
        Contact,
        Device,
        AuthSession,
        PhoneVerification,
        User,
    ):
        await db.execute(delete(model))
    await db.commit()


# ---------------------------------------------------------------------------
# Builders
# ---------------------------------------------------------------------------


async def create_users(db: AsyncSession, rng: random.Random) -> dict[str, User]:
    users: dict[str, User] = {}
    for index, spec in enumerate(SEED_USERS):
        # A couple of accounts are online so presence is visible in the list
        # without having to open a second browser.
        online = spec.key in {"aarav", "priya"}
        user = User(
            phone_number=spec.phone_number,
            username=spec.username,
            display_name=spec.display_name,
            about=spec.about or None,
            avatar_url=None,
            avatar_color=spec.avatar_color,
            identity_key=fake_identity_key(rng),
            registration_id=rng.randint(1000, 16000),
            is_online=online,
            last_seen_at=NOW if online else NOW - timedelta(minutes=17 * (index + 1)),
        )
        db.add(user)
        users[spec.key] = user
    await db.flush()
    return users


async def create_devices(db: AsyncSession, users: dict[str, User]) -> None:
    for key, name, platform, primary in DEVICES:
        db.add(
            Device(
                user_id=users[key].id,
                name=name,
                platform=platform,
                is_primary=primary,
                last_active_at=NOW - timedelta(minutes=0 if primary else 240),
            )
        )
    await db.flush()


async def create_contacts(db: AsyncSession, users: dict[str, User]) -> None:
    for owner, target in CONTACT_EDGES:
        db.add(
            Contact(
                owner_id=users[owner].id,
                contact_user_id=users[target].id,
                nickname=None,
                is_blocked=False,
            )
        )
    await db.flush()


def build_timeline(count: int, end: datetime, rng: random.Random) -> list[datetime]:
    """Backdate a conversation so it reads like it happened over days.

    Walks backwards from the last message, with gaps that are usually a few
    minutes and occasionally several hours, which is what gives the thread its
    date dividers.
    """
    stamps: list[datetime] = []
    cursor = end
    for _ in range(count):
        stamps.append(cursor)
        gap = rng.choice([2, 3, 5, 8, 13, 21, 40, 90, 360, 900])
        cursor = cursor - timedelta(minutes=gap + rng.randint(0, 4))
    return list(reversed(stamps))


async def populate_thread(
    db: AsyncSession,
    conversation: Conversation,
    member_rows: dict[str, ConversationMember],
    users: dict[str, User],
    lines: tuple,
    end: datetime,
    unread_for: tuple[str, ...],
    unread_count: int,
    rng: random.Random,
) -> None:
    """Insert the scripted messages, their receipts, reactions and replies."""
    stamps = build_timeline(len(lines), end, rng)
    inserted: list[Message] = []
    member_keys = tuple(member_rows.keys())

    for position, line in enumerate(lines):
        sender_key, text = line[0], line[1]
        extras: dict = line[2] if len(line) > 2 else {}
        is_system = sender_key == "*"

        message = Message(
            conversation_id=conversation.id,
            sender_id=None if is_system else users[sender_key].id,
            type=MessageType.SYSTEM if is_system else MessageType.TEXT,
            body=text,
            client_id=f"seed-{conversation.id[:8]}-{position}",
            created_at=stamps[position],
            status=MessageStatus.SENT,
        )
        message.envelope_hash = envelope_hash(text, message.client_id)

        if "reply" in extras:
            target = inserted[extras["reply"]]
            message.reply_to_id = target.id

        db.add(message)
        await db.flush()
        inserted.append(message)

        for reactor_key, emoji in extras.get("react", []):
            if reactor_key in member_rows:
                db.add(
                    Reaction(
                        message_id=message.id,
                        user_id=users[reactor_key].id,
                        emoji=emoji,
                        created_at=stamps[position] + timedelta(seconds=40),
                    )
                )

    # Read cursors. A member who is "unread" stops short of the end by
    # unread_count messages; everyone else has read the whole thread.
    cursor_index: dict[str, int] = {}
    for key in member_keys:
        if key in unread_for and unread_count > 0:
            cursor_index[key] = max(-1, len(inserted) - 1 - unread_count)
        else:
            cursor_index[key] = len(inserted) - 1

    for key, index in cursor_index.items():
        member_rows[key].last_read_message_id = (
            inserted[index].id if index >= 0 else None
        )

    # Receipts: one row per recipient per message, never for the sender.
    for position, message in enumerate(inserted):
        if message.type == MessageType.SYSTEM:
            continue
        recipients = [k for k in member_keys if users[k].id != message.sender_id]
        read_by_all = True
        for key in recipients:
            has_read = cursor_index[key] >= position
            db.add(
                MessageReceipt(
                    message_id=message.id,
                    user_id=users[key].id,
                    delivered_at=message.created_at + timedelta(seconds=2),
                    read_at=(
                        message.created_at + timedelta(seconds=rng.randint(20, 600))
                        if has_read
                        else None
                    ),
                )
            )
            read_by_all = read_by_all and has_read

        # The sender-side rollup: delivered means everyone received it, read
        # means everyone read it.
        message.status = MessageStatus.READ if read_by_all else MessageStatus.DELIVERED

    last = inserted[-1]
    conversation.last_message_id = last.id
    conversation.last_activity_at = last.created_at
    await db.flush()


async def create_direct_threads(
    db: AsyncSession, users: dict[str, User], rng: random.Random
) -> int:
    created = 0
    for spec in DIRECT_THREADS:
        a_key, b_key = spec["pair"]
        a, b = users[a_key], users[b_key]
        conversation = Conversation(
            type=ConversationType.DIRECT,
            name=None,
            dm_key=build_dm_key(a.id, b.id),
            created_by=a.id,
            disappearing_seconds=spec.get("disappearing_seconds", 0),
            avatar_color="A200",
            last_activity_at=NOW,
        )
        db.add(conversation)
        await db.flush()

        members = {}
        for key in (a_key, b_key):
            row = ConversationMember(
                conversation_id=conversation.id,
                user_id=users[key].id,
                # Direct threads have no admin concept; both sides are peers.
                role=MemberRole.MEMBER,
                joined_at=NOW - timedelta(days=12),
            )
            db.add(row)
            members[key] = row
        await db.flush()

        await populate_thread(
            db,
            conversation,
            members,
            users,
            spec["lines"],
            NOW - timedelta(minutes=spec["minutes_ago_end"]),
            spec["unread_for"],
            spec["unread_count"],
            rng,
        )
        created += 1
    return created


async def create_group_threads(
    db: AsyncSession, users: dict[str, User], rng: random.Random
) -> int:
    created = 0
    for spec in GROUP_THREADS:
        conversation = Conversation(
            type=ConversationType.GROUP,
            name=spec["name"],
            description=spec["description"],
            dm_key=None,
            avatar_color=spec["avatar_color"],
            created_by=users[spec["admin"]].id,
            disappearing_seconds=0,
            last_activity_at=NOW,
        )
        db.add(conversation)
        await db.flush()

        members = {}
        for key in spec["members"]:
            row = ConversationMember(
                conversation_id=conversation.id,
                user_id=users[key].id,
                role=MemberRole.ADMIN if key == spec["admin"] else MemberRole.MEMBER,
                joined_at=NOW - timedelta(days=14),
                is_pinned=(spec["name"] == "Weekend Trek" and key == "ritvik"),
            )
            db.add(row)
            members[key] = row
        await db.flush()

        await populate_thread(
            db,
            conversation,
            members,
            users,
            spec["lines"],
            NOW - timedelta(minutes=spec["minutes_ago_end"]),
            spec["unread_for"],
            spec["unread_count"],
            rng,
        )
        created += 1
    return created


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


async def seed(force: bool = False) -> None:
    rng = random.Random(RANDOM_SEED)

    async with AsyncSessionLocal() as db:
        existing = await db.scalar(select(func.count()).select_from(User))
        if existing:
            if not force:
                print(
                    f"Database already holds {existing} accounts. "
                    "Re-run with --force to wipe and reseed."
                )
                return
            print(f"Wiping {existing} existing accounts...")
            await wipe(db)

        users = await create_users(db, rng)
        await create_devices(db, users)
        await create_contacts(db, users)
        directs = await create_direct_threads(db, users, rng)
        groups = await create_group_threads(db, users, rng)
        await db.commit()

        counts = {
            "accounts": await db.scalar(select(func.count()).select_from(User)),
            "devices": await db.scalar(select(func.count()).select_from(Device)),
            "contacts": await db.scalar(select(func.count()).select_from(Contact)),
            "conversations": await db.scalar(
                select(func.count()).select_from(Conversation)
            ),
            "memberships": await db.scalar(
                select(func.count()).select_from(ConversationMember)
            ),
            "messages": await db.scalar(select(func.count()).select_from(Message)),
            "receipts": await db.scalar(
                select(func.count()).select_from(MessageReceipt)
            ),
            "reactions": await db.scalar(select(func.count()).select_from(Reaction)),
        }

    print("\nSeed complete.")
    print(f"  {directs} direct threads, {groups} groups")
    for label, value in counts.items():
        print(f"  {label:<14} {value}")
    print("\nDemo accounts (any of these, with the fixed verification code):")
    for spec in SEED_USERS:
        print(f"  {spec.phone_number:<16} {spec.display_name}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the Signal clone database.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="wipe existing data before seeding",
    )
    args = parser.parse_args()
    asyncio.run(seed(force=args.force))


if __name__ == "__main__":
    main()
