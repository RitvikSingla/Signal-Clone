"""Endpoints that act on one message, regardless of its thread."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from app.core.deps import DbSession, RegisteredUser
from app.schemas.message import (
    EditMessageIn,
    MessageOut,
    MessageSearchHit,
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
) -> list[MessageSearchHit]:
    """Full-text search across every thread the caller belongs to."""
    return await message_service.search_messages(db, user, q, limit)


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
