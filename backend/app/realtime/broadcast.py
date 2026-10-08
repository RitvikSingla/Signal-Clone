"""Who should hear about what.

These helpers sit between the services and the hub. A service commits a
change, then one of these resolves the audience and hands the hub a frame.
Nothing here decides whether a change is allowed; that already happened.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models import ConversationMember, Message, User
from app.realtime.events import ServerEvent
from app.realtime.hub import hub
from app.schemas.message import MessageOut
from app.services import conversation_service


def _json(value: object) -> object:
    """Pydantic models carry datetimes; the socket needs plain JSON."""
    if isinstance(value, datetime):
        return value.isoformat()
    return value


async def active_member_ids(db: AsyncSession, conversation_id: str) -> list[str]:
    rows = await db.scalars(
        select(ConversationMember.user_id).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.left_at.is_(None),
        )
    )
    return list(rows)


async def peer_ids(db: AsyncSession, user_id: str) -> list[str]:
    """Everyone who shares at least one live conversation with this account.

    That is the audience for a presence change: there is no reason to tell
    someone that a stranger came online.
    """
    mine = aliased(ConversationMember)
    theirs = aliased(ConversationMember)
    rows = await db.scalars(
        select(theirs.user_id)
        .join(mine, mine.conversation_id == theirs.conversation_id)
        .where(
            mine.user_id == user_id,
            mine.left_at.is_(None),
            theirs.left_at.is_(None),
            theirs.user_id != user_id,
        )
        .distinct()
    )
    return list(rows)


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------


async def message_created(
    db: AsyncSession, message: MessageOut, sender_id: str | None
) -> None:
    """Fan a new message out to the thread, and tell the sender it is sent."""
    members = await active_member_ids(db, message.conversation_id)
    payload = {
        "type": ServerEvent.MESSAGE_NEW,
        "conversation_id": message.conversation_id,
        "message": message.model_dump(mode="json"),
    }
    await hub.send_to_users(members, payload, exclude=sender_id)

    # The sender gets a status frame instead of the message back: their
    # optimistic bubble is already on screen and reconciled over REST.
    if sender_id:
        await hub.send_to_user(
            sender_id,
            {
                "type": ServerEvent.MESSAGE_STATUS,
                "conversation_id": message.conversation_id,
                "message_id": message.id,
                "status": message.status,
            },
        )


async def message_updated(db: AsyncSession, message: MessageOut) -> None:
    """An edit, a soft delete or a reaction. Everyone in the thread sees it."""
    members = await active_member_ids(db, message.conversation_id)
    await hub.send_to_users(
        members,
        {
            "type": ServerEvent.MESSAGE_UPDATED,
            "conversation_id": message.conversation_id,
            "message": message.model_dump(mode="json"),
        },
    )


async def statuses_changed(db: AsyncSession, message_ids: list[str]) -> None:
    """Tell each sender their own bubbles moved on."""
    for message_id in dict.fromkeys(message_ids):
        message = await db.get(Message, message_id)
        if message is None or message.sender_id is None:
            continue
        await hub.send_to_user(
            message.sender_id,
            {
                "type": ServerEvent.MESSAGE_STATUS,
                "conversation_id": message.conversation_id,
                "message_id": message.id,
                "status": message.status,
            },
        )


# ---------------------------------------------------------------------------
# Typing and presence
# ---------------------------------------------------------------------------


async def typing(
    db: AsyncSession, conversation_id: str, user: User, is_typing: bool
) -> None:
    members = await active_member_ids(db, conversation_id)
    await hub.send_to_users(
        members,
        {
            "type": ServerEvent.TYPING,
            "conversation_id": conversation_id,
            "user_id": user.id,
            "display_name": user.display_name,
            "is_typing": is_typing,
        },
        exclude=user.id,
    )


async def presence_changed(db: AsyncSession, user: User) -> None:
    targets = await peer_ids(db, user.id)
    await hub.send_to_users(
        targets,
        {
            "type": ServerEvent.PRESENCE,
            "user_id": user.id,
            "is_online": user.is_online,
            "last_seen_at": _json(user.last_seen_at),
        },
    )


async def set_presence(db: AsyncSession, user: User, online: bool) -> None:
    """Write presence to the row, then tell the people who can see it."""
    user.is_online = online
    user.last_seen_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)
    await presence_changed(db, user)


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------


async def conversation_updated(db: AsyncSession, conversation_id: str) -> None:
    """A membership or settings change. Each member gets their own view of
    the row, because unread counts and preferences differ per person."""
    members = await active_member_ids(db, conversation_id)
    for member_id in members:
        summary = await conversation_service.load_summary_for(
            db, member_id, conversation_id
        )
        if summary is None:
            continue
        await hub.send_to_user(
            member_id,
            {
                "type": ServerEvent.CONVERSATION_UPDATED,
                "conversation": summary.model_dump(mode="json"),
            },
        )
