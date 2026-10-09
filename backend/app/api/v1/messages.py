"""Endpoints that act on one message, regardless of its thread."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response

from app.core.deps import DbSession, RegisteredUser
from app.schemas.message import (
    EditMessageIn,
    ForwardIn,
    MessageInfoOut,
    MessageOut,
    MessageSearchHit,
    PinMessageIn,
    ReactionIn,
)
from app.realtime import broadcast
from app.services import message_service
from app.services.conversation_service import ConversationError

router = APIRouter(tags=["messages"])


def _fail(exc: ConversationError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("/messages/search", response_model=list[MessageSearchHit])
async def search(
    user: RegisteredUser,
    db: DbSession,
    q: Annotated[str, Query(min_length=1, max_length=100)],
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    conversation_id: Annotated[str | None, Query()] = None,
) -> list[MessageSearchHit]:
    """Full-text search across the caller's threads, or within one thread."""
    return await message_service.search_messages(db, user, q, limit, conversation_id)


@router.patch("/messages/{message_id}", response_model=MessageOut)
async def edit(
    message_id: str, payload: EditMessageIn, user: RegisteredUser, db: DbSession
) -> MessageOut:
    try:
        message = await message_service.edit_message(db, user, message_id, payload.body)
    except ConversationError as exc:
        raise _fail(exc) from exc
    await broadcast.message_updated(db, message)
    return message


@router.delete("/messages/{message_id}", response_model=MessageOut)
async def delete(message_id: str, user: RegisteredUser, db: DbSession) -> MessageOut:
    """Soft delete. Everyone in the thread sees a tombstone."""
    try:
        message = await message_service.delete_message(db, user, message_id)
    except ConversationError as exc:
        raise _fail(exc) from exc
    await broadcast.message_updated(db, message)
    return message


@router.put("/messages/{message_id}/reaction", response_model=MessageOut)
async def react(
    message_id: str, payload: ReactionIn, user: RegisteredUser, db: DbSession
) -> MessageOut:
    """Set the caller's emoji. Sending the same one again clears it."""
    try:
        message = await message_service.set_reaction(db, user, message_id, payload.emoji)
    except ConversationError as exc:
        raise _fail(exc) from exc
    await broadcast.message_updated(db, message)
    return message


@router.delete("/messages/{message_id}/reaction", response_model=MessageOut)
async def unreact(message_id: str, user: RegisteredUser, db: DbSession) -> MessageOut:
    try:
        message = await message_service.clear_reaction(db, user, message_id)
    except ConversationError as exc:
        raise _fail(exc) from exc
    await broadcast.message_updated(db, message)
    return message


@router.put("/messages/{message_id}/pin", response_model=MessageOut)
async def pin(
    message_id: str, payload: PinMessageIn, user: RegisteredUser, db: DbSession
) -> MessageOut:
    """Pin for everyone in the thread, for a duration or forever (null)."""
    try:
        changed, event = await message_service.pin_message(
            db, user, message_id, payload.duration_seconds
        )
    except ConversationError as exc:
        raise _fail(exc) from exc
    for message in changed:
        await broadcast.message_updated(db, message)
    # No optimistic copy exists anywhere, so every member gets the event.
    await broadcast.message_created(db, event, None)
    return next(m for m in changed if m.id == message_id)


@router.delete("/messages/{message_id}/pin", response_model=MessageOut)
async def unpin(message_id: str, user: RegisteredUser, db: DbSession) -> MessageOut:
    try:
        message = await message_service.unpin_message(db, user, message_id)
    except ConversationError as exc:
        raise _fail(exc) from exc
    await broadcast.message_updated(db, message)
    return message


@router.post("/messages/{message_id}/hide", status_code=204, response_class=Response)
async def hide(message_id: str, user: RegisteredUser, db: DbSession) -> Response:
    """Delete for me. Nobody else is told, because nothing changed for them."""
    try:
        await message_service.hide_message(db, user, message_id)
    except ConversationError as exc:
        raise _fail(exc) from exc
    return Response(status_code=204)


@router.post("/messages/forward", response_model=list[MessageOut])
async def forward(payload: ForwardIn, user: RegisteredUser, db: DbSession) -> list[MessageOut]:
    try:
        created = await message_service.forward_messages(
            db, user, payload.message_ids, payload.conversation_ids
        )
    except ConversationError as exc:
        raise _fail(exc) from exc
    for message in created:
        await broadcast.message_created(db, message, user.id)
    return created


@router.get("/messages/{message_id}/info", response_model=MessageInfoOut)
async def info(message_id: str, user: RegisteredUser, db: DbSession) -> MessageInfoOut:
    try:
        return await message_service.message_info(db, user, message_id)
    except ConversationError as exc:
        raise _fail(exc) from exc
