"""Conversation and membership rules.

Routers never touch the ORM directly; everything a thread can do lives here.
Errors are raised as ConversationError and translated at the edge.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.models import (
    Conversation,
    ConversationMember,
    ConversationType,
    MemberRole,
    Message,
    MessageType,
    User,
    build_dm_key,
)
from app.schemas.conversation import (
    ConversationDetail,
    ConversationSummary,
    MemberOut,
)
from app.schemas.common import UserPublic
from app.schemas.message import MessagePreview


class ConversationError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Loading helpers
# ---------------------------------------------------------------------------


def _loaded(stmt: Select) -> Select:
    """Eager-load everything a summary or detail needs.

    Without this the conversation list would issue a query per row for
    members and another for the last message. With it the whole list costs
    three queries no matter how many threads there are.
    """
    return stmt.options(
        selectinload(Conversation.members).selectinload(ConversationMember.user),
        selectinload(Conversation.last_message).selectinload(Message.sender),
    )


async def _unread_counts(
    db: AsyncSession, user_id: str, conversation_ids: list[str]
) -> dict[str, int]:
    """Unread per thread, derived from each membership's read cursor.

    One grouped query for every thread at once. A message counts as unread
    when it was sent by someone else, is not deleted, and was created after
    the message the cursor points at. A null cursor means nothing has been
    read, so everything counts.
    """
    if not conversation_ids:
        return {}

    cursor = aliased(Message)
    stmt = (
        select(ConversationMember.conversation_id, func.count(Message.id))
        .select_from(ConversationMember)
        .join(Message, Message.conversation_id == ConversationMember.conversation_id)
        .outerjoin(cursor, cursor.id == ConversationMember.last_read_message_id)
        .where(
            ConversationMember.user_id == user_id,
            ConversationMember.conversation_id.in_(conversation_ids),
            Message.deleted_at.is_(None),
            Message.sender_id.is_not(None),
            Message.sender_id != user_id,
            or_(cursor.id.is_(None), Message.created_at > cursor.created_at),
        )
        .group_by(ConversationMember.conversation_id)
    )
    rows = await db.execute(stmt)
    return {conversation_id: count for conversation_id, count in rows}


def _peer_of(conversation: Conversation, me_id: str) -> User | None:
    if conversation.type != ConversationType.DIRECT:
        return None
    for member in conversation.members:
        if member.user_id != me_id:
            return member.user
    return None


def _preview(message: Message | None) -> MessagePreview | None:
    if message is None:
        return None
    return MessagePreview(
        id=message.id,
        sender_id=message.sender_id,
        sender_name=message.sender.display_name if message.sender else None,
        type=message.type,
        body=None if message.deleted_at else message.body,
        status=message.status,
        is_deleted=message.deleted_at is not None,
        event=message.event,
        created_at=message.created_at,
    )


def build_summary(
    conversation: Conversation,
    membership: ConversationMember,
    unread: int,
) -> ConversationSummary:
    """Resolve a thread into the row the list renders.

    A direct thread has no name or avatar of its own; it borrows both from
    the other person, which is why that resolution happens here rather than
    being duplicated in the client.
    """
    me_id = membership.user_id
    peer = _peer_of(conversation, me_id)
    active_members = [m for m in conversation.members if m.left_at is None]

    if conversation.type == ConversationType.GROUP:
        title = conversation.name or "Group"
        avatar_url = conversation.avatar_url
        avatar_color = conversation.avatar_color
    else:
        title = peer.display_name if peer else "Unknown"
        avatar_url = peer.avatar_url if peer else None
        avatar_color = peer.avatar_color if peer else "A200"

    muted = membership.muted_until is not None and membership.muted_until > _now()

    return ConversationSummary(
        id=conversation.id,
        type=conversation.type,
        title=title,
        avatar_url=avatar_url,
        avatar_color=avatar_color,
        peer=UserPublic.model_validate(peer) if peer else None,
        last_message=_preview(conversation.last_message),
        unread_count=unread,
        member_count=len(active_members),
        my_role=membership.role,
        is_pinned=membership.is_pinned,
        is_archived=membership.is_archived,
        is_muted=muted,
        disappearing_seconds=conversation.disappearing_seconds,
        last_activity_at=conversation.last_activity_at,
    )


def _build_detail(
    conversation: Conversation, membership: ConversationMember, unread: int
) -> ConversationDetail:
    summary = build_summary(conversation, membership, unread)
    members = [
        MemberOut(
            user=UserPublic.model_validate(m.user),
            role=m.role,
            joined_at=m.joined_at,
            left_at=m.left_at,
            is_active=m.left_at is None,
        )
        for m in sorted(
            conversation.members,
            key=lambda m: (m.left_at is not None, m.role != MemberRole.ADMIN, m.joined_at),
        )
    ]
    return ConversationDetail(
        **summary.model_dump(),
        description=conversation.description,
        created_by=conversation.created_by,
        members=members,
    )


# ---------------------------------------------------------------------------
# Access checks
# ---------------------------------------------------------------------------


async def require_membership(
    db: AsyncSession, user: User, conversation_id: str, *, active_only: bool = True
) -> ConversationMember:
    membership = await db.scalar(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == user.id,
        )
    )
    # Same error for "does not exist" and "not a member", so the API never
    # confirms the existence of a thread the caller cannot see.
    if membership is None or (active_only and membership.left_at is not None):
        raise ConversationError("Conversation not found.", 404)
    return membership


async def require_admin(
    db: AsyncSession, user: User, conversation: Conversation
) -> ConversationMember:
    membership = await require_membership(db, user, conversation.id)
    if conversation.type == ConversationType.GROUP and not membership.is_admin:
        raise ConversationError("Only an admin can do that.", 403)
    return membership


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------


async def list_conversations(
    db: AsyncSession,
    user: User,
    *,
    unread_only: bool = False,
    archived: bool = False,
    search: str | None = None,
) -> list[ConversationSummary]:
    stmt = (
        select(Conversation, ConversationMember)
        .join(
            ConversationMember,
            ConversationMember.conversation_id == Conversation.id,
        )
        .where(
            ConversationMember.user_id == user.id,
            ConversationMember.left_at.is_(None),
            ConversationMember.is_archived.is_(archived),
        )
        .order_by(
            ConversationMember.is_pinned.desc(),
            Conversation.last_activity_at.desc(),
        )
    )
    rows = (await db.execute(_loaded(stmt))).unique().all()

    conversation_ids = [conversation.id for conversation, _ in rows]
    unread_map = await _unread_counts(db, user.id, conversation_ids)

    summaries = [
        build_summary(conversation, membership, unread_map.get(conversation.id, 0))
        for conversation, membership in rows
    ]

    if unread_only:
        summaries = [s for s in summaries if s.unread_count > 0]

    if search:
        # Title search happens here rather than in SQL because a direct
        # thread's title is the peer's name, which is not a column on the
        # conversation. Message-body search is a separate endpoint backed
        # by FTS5.
        needle = search.strip().lower()
        summaries = [
            s
            for s in summaries
            if needle in s.title.lower()
            or (s.peer and s.peer.username and needle in s.peer.username.lower())
            or (s.peer and needle in s.peer.phone_number)
        ]

    return summaries


async def get_conversation(
    db: AsyncSession, user: User, conversation_id: str
) -> ConversationDetail:
    membership = await require_membership(db, user, conversation_id)
    conversation = await db.scalar(
        _loaded(select(Conversation).where(Conversation.id == conversation_id))
    )
    if conversation is None:
        raise ConversationError("Conversation not found.", 404)
    unread = (await _unread_counts(db, user.id, [conversation_id])).get(
        conversation_id, 0
    )
    return _build_detail(conversation, membership, unread)


async def load_summary_for(
    db: AsyncSession, user_id: str, conversation_id: str
) -> ConversationSummary | None:
    """Build one row for a specific account, used when broadcasting."""
    row = (
        await db.execute(
            _loaded(
                select(Conversation, ConversationMember)
                .join(
                    ConversationMember,
                    ConversationMember.conversation_id == Conversation.id,
                )
                .where(
                    Conversation.id == conversation_id,
                    ConversationMember.user_id == user_id,
                )
            )
        )
    ).unique().first()
    if row is None:
        return None
    conversation, membership = row
    unread = (await _unread_counts(db, user_id, [conversation_id])).get(
        conversation_id, 0
    )
    return build_summary(conversation, membership, unread)


# ---------------------------------------------------------------------------
# Writes
# ---------------------------------------------------------------------------


async def add_system_message(
    db: AsyncSession, conversation: Conversation, text: str
) -> Message:
    """Membership and settings changes are recorded in the thread itself."""
    message = Message(
        conversation_id=conversation.id,
        sender_id=None,
        type=MessageType.SYSTEM,
        body=text,
        envelope_hash="",
        client_id=f"sys-{_now().timestamp():.6f}",
        created_at=_now(),
    )
    db.add(message)
    await db.flush()
    conversation.last_message_id = message.id
    conversation.last_activity_at = message.created_at
    return message


async def create_direct(
    db: AsyncSession, user: User, peer_id: str
) -> tuple[ConversationDetail, bool]:
    """Return the thread with this person, creating it only if absent."""
    if peer_id == user.id:
        raise ConversationError("You cannot start a conversation with yourself.", 400)

    peer = await db.get(User, peer_id)
    if peer is None:
        raise ConversationError("That account does not exist.", 404)

    dm_key = build_dm_key(user.id, peer.id)
    existing = await db.scalar(select(Conversation).where(Conversation.dm_key == dm_key))
    if existing is not None:
        return await get_conversation(db, user, existing.id), False

    conversation = Conversation(
        type=ConversationType.DIRECT,
        dm_key=dm_key,
        created_by=user.id,
        avatar_color="A200",
        last_activity_at=_now(),
    )
    db.add(conversation)
    await db.flush()

    for member_id in (user.id, peer.id):
        db.add(
            ConversationMember(
                conversation_id=conversation.id,
                user_id=member_id,
                role=MemberRole.MEMBER,
            )
        )
    await db.commit()
    return await get_conversation(db, user, conversation.id), True


async def create_group(
    db: AsyncSession,
    user: User,
    name: str,
    member_ids: list[str],
    description: str | None,
) -> ConversationDetail:
    unique_ids = {mid for mid in member_ids if mid != user.id}
    if not unique_ids:
        raise ConversationError("Add at least one other person.", 400)

    found = (await db.scalars(select(User).where(User.id.in_(unique_ids)))).all()
    if len(found) != len(unique_ids):
        raise ConversationError("One of those accounts does not exist.", 404)

    conversation = Conversation(
        type=ConversationType.GROUP,
        name=name.strip(),
        description=(description or "").strip() or None,
        created_by=user.id,
        avatar_color="A200",
        last_activity_at=_now(),
    )
    db.add(conversation)
    await db.flush()

    # The creator is the first admin. Everyone else joins as a member.
    db.add(
        ConversationMember(
            conversation_id=conversation.id,
            user_id=user.id,
            role=MemberRole.ADMIN,
        )
    )
    for member_id in unique_ids:
        db.add(
            ConversationMember(
                conversation_id=conversation.id,
                user_id=member_id,
                role=MemberRole.MEMBER,
            )
        )
    await db.flush()

    await add_system_message(db, conversation, f"{user.display_name} created the group.")
    names = ", ".join(sorted(u.display_name for u in found))
    await add_system_message(db, conversation, f"{user.display_name} added {names}.")

    await db.commit()
    return await get_conversation(db, user, conversation.id)


async def update_conversation(
    db: AsyncSession,
    user: User,
    conversation_id: str,
    *,
    name: str | None,
    description: str | None,
    avatar_color: str | None,
    disappearing_seconds: int | None,
) -> ConversationDetail:
    await require_membership(db, user, conversation_id)
    conversation = await db.get(Conversation, conversation_id)
    if conversation is None:
        raise ConversationError("Conversation not found.", 404)

    if name is not None or description is not None or avatar_color is not None:
        await require_admin(db, user, conversation)
        if conversation.type != ConversationType.GROUP:
            raise ConversationError("A direct conversation has no name.", 400)
        if name is not None:
            conversation.name = name.strip()
            await add_system_message(
                db, conversation, f"{user.display_name} changed the group name."
            )
        if description is not None:
            conversation.description = description.strip() or None
        if avatar_color is not None:
            conversation.avatar_color = avatar_color

    # Anyone in the thread may change the timer, which matches Signal.
    if disappearing_seconds is not None:
        conversation.disappearing_seconds = disappearing_seconds
        label = (
            "off"
            if disappearing_seconds == 0
            else _humanise_duration(disappearing_seconds)
        )
        await add_system_message(
            db, conversation, f"{user.display_name} set disappearing messages to {label}."
        )

    await db.commit()
    return await get_conversation(db, user, conversation_id)


def _humanise_duration(seconds: int) -> str:
    for unit_seconds, label in ((604800, "week"), (86400, "day"), (3600, "hour"), (60, "minute")):
        if seconds % unit_seconds == 0:
            count = seconds // unit_seconds
            return f"{count} {label}{'s' if count > 1 else ''}"
    return f"{seconds} seconds"


async def update_prefs(
    db: AsyncSession,
    user: User,
    conversation_id: str,
    *,
    is_pinned: bool | None,
    is_archived: bool | None,
    muted_until: datetime | None,
) -> ConversationSummary:
    membership = await require_membership(db, user, conversation_id)
    if is_pinned is not None:
        membership.is_pinned = is_pinned
    if is_archived is not None:
        membership.is_archived = is_archived
    if muted_until is not None:
        membership.muted_until = muted_until
    await db.commit()

    summary = await load_summary_for(db, user.id, conversation_id)
    if summary is None:
        raise ConversationError("Conversation not found.", 404)
    return summary


async def add_members(
    db: AsyncSession, user: User, conversation_id: str, user_ids: list[str]
) -> ConversationDetail:
    conversation = await db.get(Conversation, conversation_id)
    if conversation is None:
        raise ConversationError("Conversation not found.", 404)
    if conversation.type != ConversationType.GROUP:
        raise ConversationError("You cannot add people to a direct conversation.", 400)
    await require_admin(db, user, conversation)

    added: list[str] = []
    for user_id in dict.fromkeys(user_ids):
        target = await db.get(User, user_id)
        if target is None:
            raise ConversationError("That account does not exist.", 404)

        existing = await db.scalar(
            select(ConversationMember).where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id,
            )
        )
        if existing is not None and existing.left_at is None:
            continue
        if existing is not None:
            # Rejoining: clear the leave stamp rather than inserting a
            # second membership row, which the unique constraint forbids.
            existing.left_at = None
            existing.joined_at = _now()
            existing.role = MemberRole.MEMBER
        else:
            db.add(
                ConversationMember(
                    conversation_id=conversation_id,
                    user_id=user_id,
                    role=MemberRole.MEMBER,
                )
            )
        added.append(target.display_name)

    if added:
        await add_system_message(
            db, conversation, f"{user.display_name} added {', '.join(sorted(added))}."
        )
    await db.commit()
    return await get_conversation(db, user, conversation_id)


async def remove_member(
    db: AsyncSession, user: User, conversation_id: str, target_id: str
) -> ConversationDetail:
    conversation = await db.get(Conversation, conversation_id)
    if conversation is None:
        raise ConversationError("Conversation not found.", 404)
    if conversation.type != ConversationType.GROUP:
        raise ConversationError("You cannot remove people from a direct conversation.", 400)
    await require_admin(db, user, conversation)

    if target_id == user.id:
        raise ConversationError("Use leave to remove yourself.", 400)

    membership = await db.scalar(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == target_id,
            ConversationMember.left_at.is_(None),
        )
    )
    if membership is None:
        raise ConversationError("That person is not in this group.", 404)

    membership.left_at = _now()
    target = await db.get(User, target_id)
    await add_system_message(
        db,
        conversation,
        f"{user.display_name} removed {target.display_name if target else 'someone'}.",
    )
    await db.commit()
    return await get_conversation(db, user, conversation_id)


async def change_role(
    db: AsyncSession, user: User, conversation_id: str, target_id: str, role: MemberRole
) -> ConversationDetail:
    conversation = await db.get(Conversation, conversation_id)
    if conversation is None:
        raise ConversationError("Conversation not found.", 404)
    await require_admin(db, user, conversation)

    membership = await db.scalar(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == target_id,
            ConversationMember.left_at.is_(None),
        )
    )
    if membership is None:
        raise ConversationError("That person is not in this group.", 404)

    if membership.role == MemberRole.ADMIN and role == MemberRole.MEMBER:
        remaining = await db.scalar(
            select(func.count())
            .select_from(ConversationMember)
            .where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.role == MemberRole.ADMIN,
                ConversationMember.left_at.is_(None),
            )
        )
        if remaining <= 1:
            raise ConversationError("A group needs at least one admin.", 409)

    membership.role = role
    target = await db.get(User, target_id)
    verb = "made" if role == MemberRole.ADMIN else "removed"
    suffix = "an admin" if role == MemberRole.ADMIN else "as an admin"
    await add_system_message(
        db,
        conversation,
        f"{user.display_name} {verb} {target.display_name if target else 'someone'} {suffix}.",
    )
    await db.commit()
    return await get_conversation(db, user, conversation_id)


async def leave(db: AsyncSession, user: User, conversation_id: str) -> None:
    membership = await require_membership(db, user, conversation_id)
    conversation = await db.get(Conversation, conversation_id)
    if conversation is None or conversation.type != ConversationType.GROUP:
        raise ConversationError("You can only leave a group.", 400)

    membership.left_at = _now()
    await db.flush()

    # If the last admin leaves, promote the longest-standing member so the
    # group never becomes unmanageable.
    admins_left = await db.scalar(
        select(func.count())
        .select_from(ConversationMember)
        .where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.role == MemberRole.ADMIN,
            ConversationMember.left_at.is_(None),
        )
    )
    if not admins_left:
        successor = await db.scalar(
            select(ConversationMember)
            .where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.left_at.is_(None),
            )
            .order_by(ConversationMember.joined_at)
            .limit(1)
        )
        if successor is not None:
            successor.role = MemberRole.ADMIN

    await add_system_message(db, conversation, f"{user.display_name} left the group.")
    await db.commit()


async def mark_read(
    db: AsyncSession, user: User, conversation_id: str, last_message_id: str | None
) -> tuple[ConversationMember, list[str]]:
    """Advance the read cursor and fill the matching receipts.

    Returns the membership and the ids of messages whose receipts changed, so
    the caller can tell the senders their bubbles are now read.
    """
    from app.models import MessageReceipt  # local import avoids a cycle

    membership = await require_membership(db, user, conversation_id)

    if last_message_id is None:
        target = await db.scalar(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
    else:
        target = await db.get(Message, last_message_id)
        if target is None or target.conversation_id != conversation_id:
            raise ConversationError("That message is not in this conversation.", 400)

    if target is None:
        return membership, []

    membership.last_read_message_id = target.id

    unread_receipts = (
        await db.scalars(
            select(MessageReceipt)
            .join(Message, Message.id == MessageReceipt.message_id)
            .where(
                MessageReceipt.user_id == user.id,
                MessageReceipt.read_at.is_(None),
                Message.conversation_id == conversation_id,
                Message.created_at <= target.created_at,
            )
        )
    ).all()

    now = _now()
    touched: list[str] = []
    for receipt in unread_receipts:
        receipt.read_at = now
        if receipt.delivered_at is None:
            receipt.delivered_at = now
        touched.append(receipt.message_id)

    await db.commit()
    return membership, touched
