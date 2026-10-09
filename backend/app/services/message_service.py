"""Message rules: send, page, edit, delete, react, pin, forward, search.

The status rollup is the part worth understanding. A message row caches a
single status so the thread renders without an aggregate per bubble, but the
truth lives in message_receipts. `recompute_status` collapses many receipts
into the one value the sender sees.
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete as sql_delete
from sqlalchemy import exists, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models import (
    Attachment,
    Conversation,
    ConversationMember,
    Message,
    MessageHide,
    MessageReceipt,
    MessageStatus,
    MessageType,
    Reaction,
    User,
)
from app.schemas.common import UserPublic
from app.schemas.message import (
    AttachmentOut,
    MessageInfoOut,
    MessageOut,
    MessagePage,
    MessageSearchHit,
    QuotedMessage,
    ReactionOut,
    ReceiptOut,
)
from app.services.conversation_service import (
    ConversationError,
    require_allowed,
    require_membership,
)

DEFAULT_PAGE_SIZE = 40
MAX_PAGE_SIZE = 100
#: Signal allows an edit for a limited window after sending.
EDIT_WINDOW = timedelta(hours=24)
#: Signal keeps at most three pinned messages per chat; pinning a fourth
#: unpins the oldest.
MAX_PINS = 3


def _now() -> datetime:
    return datetime.now(timezone.utc)


def envelope_hash(body: str | None, client_id: str) -> str:
    """Simulated envelope digest. It protects nothing; it exists so the
    message-info sheet has something real and per-message to display."""
    return hashlib.sha256(f"{client_id}:{body or ''}".encode()).hexdigest()[:32]


# ---------------------------------------------------------------------------
# Serialisation
# ---------------------------------------------------------------------------


def _attachment_out(attachment: Attachment) -> AttachmentOut:
    base = settings.media_url_prefix
    return AttachmentOut(
        id=attachment.id,
        file_name=attachment.file_name,
        content_type=attachment.content_type,
        size_bytes=attachment.size_bytes,
        url=f"{base}/{attachment.storage_path}",
        width=attachment.width,
        height=attachment.height,
        thumbnail_url=(
            f"{base}/{attachment.thumbnail_path}" if attachment.thumbnail_path else None
        ),
    )


def _pin_live(message: Message, now: datetime | None = None) -> bool:
    if message.pinned_at is None or message.deleted_at is not None:
        return False
    if message.pin_expires_at is None:
        return True
    return message.pin_expires_at > (now or _now())


def to_out(message: Message) -> MessageOut:
    """Serialise a fully loaded message. Relationships must be eager-loaded."""
    pinned = _pin_live(message)
    quoted: QuotedMessage | None = None
    if message.reply_to is not None:
        target = message.reply_to
        quoted = QuotedMessage(
            id=target.id,
            sender_name=target.sender.display_name if target.sender else None,
            body=None if target.deleted_at else target.body,
            type=target.type,
            is_deleted=target.deleted_at is not None,
        )

    return MessageOut(
        id=message.id,
        conversation_id=message.conversation_id,
        sender=UserPublic.model_validate(message.sender) if message.sender else None,
        type=message.type,
        # A deleted message keeps its row so the thread can render a
        # tombstone, but the body never leaves the server again.
        body=None if message.deleted_at else message.body,
        envelope_hash=message.envelope_hash,
        status=message.status,
        client_id=message.client_id,
        reply_to=quoted,
        reactions=[
            ReactionOut(
                emoji=r.emoji,
                user_id=r.user_id,
                display_name=r.user.display_name if r.user else "",
            )
            for r in message.reactions
        ],
        attachments=[_attachment_out(a) for a in message.attachments],
        edited_at=message.edited_at,
        deleted_at=message.deleted_at,
        expires_at=message.expires_at,
        is_forwarded=message.is_forwarded,
        event=message.event,
        pinned_at=message.pinned_at if pinned else None,
        pin_expires_at=message.pin_expires_at if pinned else None,
        pinned_by=message.pinned_by_id if pinned else None,
        created_at=message.created_at,
    )


def _with_relations(stmt):
    return stmt.options(
        selectinload(Message.sender),
        selectinload(Message.reply_to).selectinload(Message.sender),
        selectinload(Message.reactions).selectinload(Reaction.user),
        selectinload(Message.attachments),
    )


async def load_out(db: AsyncSession, message_id: str) -> MessageOut:
    message = await db.scalar(
        _with_relations(select(Message).where(Message.id == message_id))
    )
    if message is None:
        raise ConversationError("Message not found.", 404)
    return to_out(message)


# ---------------------------------------------------------------------------
# Reading
# ---------------------------------------------------------------------------


async def list_messages(
    db: AsyncSession,
    user: User,
    conversation_id: str,
    *,
    before: str | None = None,
    limit: int = DEFAULT_PAGE_SIZE,
) -> MessagePage:
    """One page of a thread, newest last.

    Paged by cursor rather than offset: an offset shifts underneath you when
    a message arrives mid-scroll, so page two would repeat or skip a row.
    """
    await require_membership(db, user, conversation_id)
    limit = max(1, min(limit, MAX_PAGE_SIZE))

    stmt = select(Message).where(
        Message.conversation_id == conversation_id,
        # Delete for me: hidden rows never reach this reader again.
        ~exists().where(
            MessageHide.message_id == Message.id, MessageHide.user_id == user.id
        ),
    )

    if before:
        anchor = await db.get(Message, before)
        if anchor is None or anchor.conversation_id != conversation_id:
            raise ConversationError("That cursor is not in this conversation.", 400)
        stmt = stmt.where(Message.created_at < anchor.created_at)

    # Fetch one extra row to learn whether another page exists, without a
    # second count query.
    stmt = stmt.order_by(Message.created_at.desc()).limit(limit + 1)
    rows = list((await db.scalars(_with_relations(stmt))).unique().all())

    has_more = len(rows) > limit
    rows = rows[:limit]
    rows.reverse()

    return MessagePage(
        messages=[to_out(m) for m in rows],
        next_before=rows[0].id if rows and has_more else None,
        has_more=has_more,
    )


# ---------------------------------------------------------------------------
# Status rollup
# ---------------------------------------------------------------------------


async def recompute_status(db: AsyncSession, message: Message) -> MessageStatus:
    """Collapse the receipts for one message into the sender's status.

    delivered means every active recipient has a delivery row.
    read means every active recipient has a read row.

    In a one-to-one thread that is the familiar single and double check. In a
    group it is the same rule applied to more rows, which is why the receipt
    table exists at all.
    """
    if message.type == MessageType.SYSTEM or message.sender_id is None:
        return message.status

    recipients = await db.scalar(
        select(func.count())
        .select_from(ConversationMember)
        .where(
            ConversationMember.conversation_id == message.conversation_id,
            ConversationMember.user_id != message.sender_id,
            ConversationMember.left_at.is_(None),
        )
    )
    if not recipients:
        message.status = MessageStatus.SENT
        return message.status

    delivered = await db.scalar(
        select(func.count())
        .select_from(MessageReceipt)
        .where(
            MessageReceipt.message_id == message.id,
            MessageReceipt.delivered_at.is_not(None),
        )
    )
    read = await db.scalar(
        select(func.count())
        .select_from(MessageReceipt)
        .where(
            MessageReceipt.message_id == message.id,
            MessageReceipt.read_at.is_not(None),
        )
    )

    if read >= recipients:
        message.status = MessageStatus.READ
    elif delivered >= recipients:
        message.status = MessageStatus.DELIVERED
    else:
        message.status = MessageStatus.SENT
    return message.status


# ---------------------------------------------------------------------------
# Writing
# ---------------------------------------------------------------------------


async def send_message(
    db: AsyncSession,
    user: User,
    conversation_id: str,
    *,
    client_id: str,
    body: str | None,
    reply_to_id: str | None,
    attachment_ids: list[str],
    is_forwarded: bool = False,
) -> tuple[MessageOut, bool]:
    """Persist a message. Returns (message, was_created).

    Idempotent on (sender, client_id): a retry after a dropped response
    returns the message that already exists instead of creating a second one.
    """
    membership = await require_membership(db, user, conversation_id)

    existing = await db.scalar(
        select(Message).where(
            Message.sender_id == user.id, Message.client_id == client_id
        )
    )
    if existing is not None:
        return await load_out(db, existing.id), False

    conversation = await db.get(Conversation, conversation_id)
    if conversation is None:
        raise ConversationError("Conversation not found.", 404)
    if conversation.ended_at is not None:
        raise ConversationError("This group has ended.", 409)
    require_allowed(conversation, membership, conversation.perm_send_messages, "send messages")

    if reply_to_id:
        target = await db.get(Message, reply_to_id)
        if target is None or target.conversation_id != conversation_id:
            raise ConversationError("You can only quote a message in this thread.", 400)

    now = _now()
    expires_at = (
        now + timedelta(seconds=conversation.disappearing_seconds)
        if conversation.disappearing_seconds
        else None
    )

    message = Message(
        conversation_id=conversation_id,
        sender_id=user.id,
        type=MessageType.IMAGE if attachment_ids else MessageType.TEXT,
        body=(body or "").strip() or None,
        envelope_hash=envelope_hash(body, client_id),
        reply_to_id=reply_to_id,
        status=MessageStatus.SENT,
        client_id=client_id,
        created_at=now,
        expires_at=expires_at,
        is_forwarded=is_forwarded,
    )
    db.add(message)
    await db.flush()

    for position, attachment_id in enumerate(attachment_ids):
        attachment = await db.get(Attachment, attachment_id)
        if (
            attachment is None
            or attachment.uploader_id != user.id
            or attachment.message_id is not None
        ):
            raise ConversationError("That attachment does not exist.", 404)
        attachment.message_id = message.id
        # Uploads finish in any order; restamp so the album keeps the order
        # the sender chose, which is the order of attachment_ids.
        attachment.created_at = now + timedelta(microseconds=position)
        if not attachment.content_type.startswith("image/"):
            message.type = MessageType.FILE

    # One receipt per active recipient, created up front so the delivery and
    # read paths only ever update rows rather than racing to insert them.
    recipients = (
        await db.scalars(
            select(ConversationMember).where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id != user.id,
                ConversationMember.left_at.is_(None),
            )
        )
    ).all()
    for member in recipients:
        db.add(MessageReceipt(message_id=message.id, user_id=member.user_id))

    conversation.last_message_id = message.id
    conversation.last_activity_at = now

    # Sending into an archived thread brings it back, which is what Signal
    # does and what a user expects.
    own_membership = await db.scalar(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == user.id,
        )
    )
    if own_membership is not None:
        own_membership.is_archived = False
        own_membership.last_read_message_id = message.id

    await db.commit()
    return await load_out(db, message.id), True


async def mark_delivered(
    db: AsyncSession, user: User, message_ids: list[str]
) -> list[str]:
    """Record arrival for the given messages. Returns ids whose status moved."""
    if not message_ids:
        return []

    receipts = (
        await db.scalars(
            select(MessageReceipt).where(
                MessageReceipt.message_id.in_(message_ids),
                MessageReceipt.user_id == user.id,
                MessageReceipt.delivered_at.is_(None),
            )
        )
    ).all()
    if not receipts:
        return []

    now = _now()
    for receipt in receipts:
        receipt.delivered_at = now
    await db.flush()

    changed: list[str] = []
    for receipt in receipts:
        message = await db.get(Message, receipt.message_id)
        if message is None:
            continue
        before = message.status
        after = await recompute_status(db, message)
        if before != after:
            changed.append(message.id)

    await db.commit()
    return changed


async def refresh_statuses(db: AsyncSession, message_ids: list[str]) -> list[str]:
    """Recompute several messages at once, used after a read cursor moves."""
    changed: list[str] = []
    for message_id in dict.fromkeys(message_ids):
        message = await db.get(Message, message_id)
        if message is None:
            continue
        before = message.status
        after = await recompute_status(db, message)
        if before != after:
            changed.append(message_id)
    await db.commit()
    return changed


async def edit_message(
    db: AsyncSession, user: User, message_id: str, body: str
) -> MessageOut:
    message = await db.get(Message, message_id)
    if message is None:
        raise ConversationError("Message not found.", 404)
    await require_membership(db, user, message.conversation_id)

    if message.sender_id != user.id:
        raise ConversationError("You can only edit your own messages.", 403)
    if message.deleted_at is not None:
        raise ConversationError("That message was deleted.", 410)
    if _now() - message.created_at > EDIT_WINDOW:
        raise ConversationError("That message is too old to edit.", 409)

    message.body = body.strip()
    message.edited_at = _now()
    message.envelope_hash = envelope_hash(message.body, message.client_id)
    await db.commit()
    return await load_out(db, message_id)


async def delete_message(db: AsyncSession, user: User, message_id: str) -> MessageOut:
    """Soft delete, so the thread can render a tombstone for everyone."""
    message = await db.get(Message, message_id)
    if message is None:
        raise ConversationError("Message not found.", 404)
    await require_membership(db, user, message.conversation_id)

    if message.sender_id != user.id:
        raise ConversationError("You can only delete your own messages.", 403)
    if message.deleted_at is None:
        message.deleted_at = _now()
        await db.commit()
    return await load_out(db, message_id)


async def set_reaction(
    db: AsyncSession, user: User, message_id: str, emoji: str
) -> MessageOut:
    """One reaction per person per message: reacting again replaces it."""
    message = await db.get(Message, message_id)
    if message is None:
        raise ConversationError("Message not found.", 404)
    await require_membership(db, user, message.conversation_id)

    existing = await db.scalar(
        select(Reaction).where(
            Reaction.message_id == message_id, Reaction.user_id == user.id
        )
    )
    if existing is None:
        db.add(Reaction(message_id=message_id, user_id=user.id, emoji=emoji))
    elif existing.emoji == emoji:
        # Tapping the same emoji twice clears it, as in the real app.
        await db.delete(existing)
    else:
        existing.emoji = emoji

    await db.commit()
    return await load_out(db, message_id)


async def clear_reaction(db: AsyncSession, user: User, message_id: str) -> MessageOut:
    message = await db.get(Message, message_id)
    if message is None:
        raise ConversationError("Message not found.", 404)
    await require_membership(db, user, message.conversation_id)

    existing = await db.scalar(
        select(Reaction).where(
            Reaction.message_id == message_id, Reaction.user_id == user.id
        )
    )
    if existing is not None:
        await db.delete(existing)
        await db.commit()
    return await load_out(db, message_id)


async def _member_message(db: AsyncSession, user: User, message_id: str) -> Message:
    message = await db.get(Message, message_id)
    if message is None:
        raise ConversationError("Message not found.", 404)
    await require_membership(db, user, message.conversation_id)
    return message


async def hide_message(db: AsyncSession, user: User, message_id: str) -> None:
    """Delete for me. Anyone in the thread may hide any message."""
    await _member_message(db, user, message_id)
    already = await db.scalar(
        select(MessageHide).where(
            MessageHide.message_id == message_id, MessageHide.user_id == user.id
        )
    )
    if already is None:
        db.add(MessageHide(message_id=message_id, user_id=user.id))
        await db.commit()


# ---------------------------------------------------------------------------
# Pins
# ---------------------------------------------------------------------------


async def list_pins(db: AsyncSession, user: User, conversation_id: str) -> list[MessageOut]:
    """Live pins, newest first, which is the order the banner cycles in."""
    await require_membership(db, user, conversation_id)
    now = _now()
    rows = (
        await db.scalars(
            _with_relations(
                select(Message)
                .where(
                    Message.conversation_id == conversation_id,
                    Message.pinned_at.is_not(None),
                    Message.deleted_at.is_(None),
                )
                .order_by(Message.pinned_at.desc())
            )
        )
    ).unique().all()
    return [to_out(m) for m in rows if _pin_live(m, now)]


async def pin_message(
    db: AsyncSession, user: User, message_id: str, duration_seconds: int | None
) -> tuple[list[MessageOut], MessageOut]:
    """Pin for everyone. Returns (messages whose pin state changed, the event).

    Records a system row, "pinned a message", whose reply_to_id points at
    the target so the thread can offer "Go to message".
    """
    message = await _member_message(db, user, message_id)
    if message.deleted_at is not None or message.type == MessageType.SYSTEM:
        raise ConversationError("That message can't be pinned.", 400)

    now = _now()
    changed: list[str] = [message.id]
    message.pinned_at = now
    message.pinned_by_id = user.id
    message.pin_expires_at = (
        now + timedelta(seconds=duration_seconds) if duration_seconds else None
    )

    # Keep the newest MAX_PINS; anything older is unpinned.
    live = [
        m
        for m in (
            await db.scalars(
                select(Message)
                .where(
                    Message.conversation_id == message.conversation_id,
                    Message.pinned_at.is_not(None),
                    Message.id != message.id,
                )
                .order_by(Message.pinned_at.desc())
            )
        ).all()
        if _pin_live(m, now)
    ]
    for stale in live[MAX_PINS - 1 :]:
        stale.pinned_at = None
        stale.pin_expires_at = None
        stale.pinned_by_id = None
        changed.append(stale.id)

    client_id = f"pin-{uuid.uuid4()}"[:36]
    event = Message(
        conversation_id=message.conversation_id,
        sender_id=user.id,
        type=MessageType.SYSTEM,
        event="pinned",
        body="pinned a message",
        envelope_hash=envelope_hash("pinned a message", client_id),
        reply_to_id=message.id,
        status=MessageStatus.SENT,
        client_id=client_id,
        created_at=now,
    )
    db.add(event)
    await db.flush()

    conversation = await db.get(Conversation, message.conversation_id)
    if conversation is not None:
        conversation.last_message_id = event.id
        conversation.last_activity_at = now

    await db.commit()
    return [await load_out(db, mid) for mid in changed], await load_out(db, event.id)


async def unpin_message(db: AsyncSession, user: User, message_id: str) -> MessageOut:
    message = await _member_message(db, user, message_id)
    message.pinned_at = None
    message.pin_expires_at = None
    message.pinned_by_id = None
    await db.commit()
    return await load_out(db, message_id)


# ---------------------------------------------------------------------------
# Forward and info
# ---------------------------------------------------------------------------


async def forward_messages(
    db: AsyncSession, user: User, message_ids: list[str], conversation_ids: list[str]
) -> list[MessageOut]:
    """Send copies of messages into other threads, marked as forwarded.

    Attachments are not re-uploaded: each copy gets new attachment rows that
    point at the same stored file.
    """
    sources: list[Message] = []
    for message_id in message_ids:
        message = await db.scalar(
            _with_relations(select(Message).where(Message.id == message_id))
        )
        if message is None:
            raise ConversationError("Message not found.", 404)
        await require_membership(db, user, message.conversation_id)
        if message.deleted_at is not None or message.type == MessageType.SYSTEM:
            raise ConversationError("That message can't be forwarded.", 400)
        sources.append(message)
    sources.sort(key=lambda m: m.created_at)

    for conversation_id in conversation_ids:
        await require_membership(db, user, conversation_id)

    created: list[MessageOut] = []
    for conversation_id in conversation_ids:
        for source in sources:
            copies: list[str] = []
            for original in source.attachments:
                copy = Attachment(
                    uploader_id=user.id,
                    file_name=original.file_name,
                    content_type=original.content_type,
                    size_bytes=original.size_bytes,
                    storage_path=original.storage_path,
                    width=original.width,
                    height=original.height,
                    thumbnail_path=original.thumbnail_path,
                )
                db.add(copy)
                await db.flush()
                copies.append(copy.id)
            out, _ = await send_message(
                db,
                user,
                conversation_id,
                client_id=str(uuid.uuid4()),
                body=source.body,
                reply_to_id=None,
                attachment_ids=copies,
                is_forwarded=True,
            )
            created.append(out)
    return created


async def message_info(db: AsyncSession, user: User, message_id: str) -> MessageInfoOut:
    message = await _member_message(db, user, message_id)
    receipts = (
        await db.scalars(
            select(MessageReceipt)
            .where(MessageReceipt.message_id == message.id)
            .options(selectinload(MessageReceipt.user))
        )
    ).all()
    # The sender sees everyone's receipts; a recipient sees only their own.
    visible = [
        r for r in receipts if message.sender_id == user.id or r.user_id == user.id
    ]
    return MessageInfoOut(
        message=await load_out(db, message.id),
        receipts=[
            ReceiptOut(
                user=UserPublic.model_validate(r.user),
                delivered_at=r.delivered_at,
                read_at=r.read_at,
            )
            for r in visible
        ],
    )


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------


async def search_messages(
    db: AsyncSession,
    user: User,
    query: str,
    limit: int = 30,
    conversation_id: str | None = None,
) -> list[MessageSearchHit]:
    """Full-text search, scoped to threads the caller belongs to.

    Backed by the FTS5 index created in the initial migration. The user's
    input is passed as a bound parameter and wrapped in quotes, so a stray
    operator is treated as text rather than FTS syntax.
    """
    cleaned = query.strip().replace('"', " ")
    if not cleaned:
        return []

    sql = text(
        """
        SELECT m.id            AS message_id,
               m.conversation_id,
               m.body,
               m.created_at,
               m.sender_id,
               u.display_name  AS sender_name,
               c.type          AS conv_type,
               c.name          AS conv_name
        FROM messages_fts f
        JOIN messages m       ON m.rowid = f.rowid
        JOIN conversations c  ON c.id = m.conversation_id
        JOIN conversation_members cm
                              ON cm.conversation_id = m.conversation_id
                             AND cm.user_id = :user_id
                             AND cm.left_at IS NULL
        LEFT JOIN users u     ON u.id = m.sender_id
        WHERE messages_fts MATCH :query
          AND m.deleted_at IS NULL
          AND (:conversation_id IS NULL OR m.conversation_id = :conversation_id)
          AND NOT EXISTS (
              SELECT 1 FROM message_hides h
              WHERE h.message_id = m.id AND h.user_id = :user_id
          )
        ORDER BY m.created_at DESC
        LIMIT :limit
        """
    )
    rows = (
        await db.execute(
            sql,
            {
                "user_id": user.id,
                # Trailing * makes the last word a prefix, so "con" finds
                # "congratulation" as it does in Signal.
                "query": f'"{cleaned}"*',
                "limit": limit,
                "conversation_id": conversation_id,
            },
        )
    ).mappings()

    hits: list[MessageSearchHit] = []
    for row in rows:
        title = row["conv_name"]
        if row["conv_type"] == "direct":
            peer = await db.scalar(
                select(User)
                .join(ConversationMember, ConversationMember.user_id == User.id)
                .where(
                    ConversationMember.conversation_id == row["conversation_id"],
                    ConversationMember.user_id != user.id,
                )
                .limit(1)
            )
            title = peer.display_name if peer else "Unknown"
        hits.append(
            MessageSearchHit(
                message_id=row["message_id"],
                conversation_id=row["conversation_id"],
                conversation_title=title or "Group",
                sender_id=row["sender_id"],
                sender_name=row["sender_name"],
                body=row["body"],
                created_at=row["created_at"],
            )
        )
    return hits


# ---------------------------------------------------------------------------
# Disappearing messages
# ---------------------------------------------------------------------------


async def sweep_expired(db: AsyncSession) -> dict[str, list[str]]:
    """Delete every message whose timer has run out.

    Returns {conversation_id: [deleted message ids]} so the caller can tell
    each thread's members. This is a hard delete, not a tombstone: the point
    of a disappearing message is that nothing of it remains. Receipts,
    reactions, hides and attachment rows go with it through ON DELETE
    CASCADE; replies that quoted it keep their own text (SET NULL); the
    full-text index drops it through its delete trigger. Stored files are
    removed once no remaining attachment row points at them (a forwarded
    copy shares the file).
    """
    now = _now()
    expired = (
        await db.scalars(
            select(Message)
            .where(Message.expires_at.is_not(None), Message.expires_at <= now)
            .options(selectinload(Message.attachments))
            .limit(500)
        )
    ).all()
    if not expired:
        return {}

    by_conversation: dict[str, list[str]] = {}
    paths: set[str] = set()
    for message in expired:
        by_conversation.setdefault(message.conversation_id, []).append(message.id)
        for attachment in message.attachments:
            paths.add(attachment.storage_path)
            if attachment.thumbnail_path:
                paths.add(attachment.thumbnail_path)
    # One statement, with the database's ON DELETE rules doing the rest
    # (foreign keys are enforced on every connection; see db/session.py).
    ids = [m.id for m in expired]
    await db.execute(sql_delete(Message).where(Message.id.in_(ids)))
    db.expunge_all()

    # Point each thread's preview at whatever is now its newest message.
    for conversation_id in by_conversation:
        conversation = await db.get(Conversation, conversation_id)
        if conversation is None:
            continue
        newest = await db.scalar(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        conversation.last_message_id = newest.id if newest else None

    await db.commit()

    for path in paths:
        still_used = await db.scalar(
            select(func.count())
            .select_from(Attachment)
            .where(
                (Attachment.storage_path == path) | (Attachment.thumbnail_path == path)
            )
        )
        if not still_used:
            (settings.media_root / path).unlink(missing_ok=True)

    return by_conversation
