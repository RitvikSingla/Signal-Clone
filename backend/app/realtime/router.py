"""The WebSocket endpoint.

Mounted on the app rather than the versioned API router, because a socket
URL is not a REST resource and FastAPI's dependency handling for sockets is
slightly different.

The socket carries no authority of its own. It authenticates with the same
access token the REST calls use, and every frame it accepts is either a
keepalive or a fact about the sender that the server re-checks before acting.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenError, decode_access_token
from app.db.session import AsyncSessionLocal
from app.models import ConversationMember, User
from app.realtime import broadcast
from app.realtime.events import ClientEvent, ServerEvent
from app.realtime.hub import hub
from app.services import message_service

logger = logging.getLogger(__name__)

router = APIRouter()

#: Guard against a client flooding the socket with huge frames.
MAX_DELIVERED_IDS = 200


async def _authenticate(token: str | None, db: AsyncSession) -> User | None:
    if not token:
        return None
    try:
        user_id = decode_access_token(token)
    except TokenError:
        return None
    user = await db.get(User, user_id)
    if user is None or not user.display_name:
        return None
    return user


async def _is_member(db: AsyncSession, user_id: str, conversation_id: str) -> bool:
    membership = await db.scalar(
        ConversationMember.__table__.select().where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == user_id,
            ConversationMember.left_at.is_(None),
        )
    )
    return membership is not None


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str | None = Query(default=None),
) -> None:
    # Its own session for the lifetime of the socket, independent of any
    # request. Closed in the finally block below.
    async with AsyncSessionLocal() as db:
        user = await _authenticate(token, db)
        if user is None:
            # Accept before closing: a close during the handshake reaches the
            # browser as a bare 403 (close code 1006), and the client could
            # not tell an expired token, which it can renew, from a dropped
            # connection.
            await websocket.accept()
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        await websocket.accept()
        first_connection = await hub.register(user.id, websocket)

        await websocket.send_json(
            {
                "type": ServerEvent.CONNECTED,
                "user_id": user.id,
                "display_name": user.display_name,
            }
        )

        if first_connection:
            await broadcast.set_presence(db, user, online=True)

        try:
            while True:
                frame = await websocket.receive_json()
                await _handle_frame(db, websocket, user, frame)
        except WebSocketDisconnect:
            pass
        except Exception:  # noqa: BLE001
            logger.exception("socket loop failed for %s", user.id)
        finally:
            last_connection = await hub.unregister(user.id, websocket)
            if last_connection:
                try:
                    await broadcast.set_presence(db, user, online=False)
                except Exception:  # noqa: BLE001
                    logger.exception("failed to clear presence for %s", user.id)


async def _handle_frame(
    db: AsyncSession, websocket: WebSocket, user: User, frame: Any
) -> None:
    if not isinstance(frame, dict):
        await hub.send_error(websocket, "Frames must be objects.")
        return

    kind = frame.get("type")

    if kind == ClientEvent.PING:
        await websocket.send_json({"type": ServerEvent.PONG})
        return

    if kind in (ClientEvent.TYPING_START, ClientEvent.TYPING_STOP):
        conversation_id = frame.get("conversation_id")
        if not isinstance(conversation_id, str):
            return
        # Re-check membership rather than trusting the frame: the socket is
        # a transport, not a source of authority.
        if not await _is_member(db, user.id, conversation_id):
            return
        await broadcast.typing(
            db, conversation_id, user, is_typing=kind == ClientEvent.TYPING_START
        )
        return

    if kind == ClientEvent.MESSAGE_DELIVERED:
        message_ids = frame.get("message_ids")
        if not isinstance(message_ids, list):
            return
        clean = [m for m in message_ids if isinstance(m, str)][:MAX_DELIVERED_IDS]
        if not clean:
            return
        # The service only fills receipts that belong to this account, so a
        # forged id changes nothing.
        changed = await message_service.mark_delivered(db, user, clean)
        if changed:
            await broadcast.statuses_changed(db, changed)
        return

    await hub.send_error(websocket, f"Unknown frame type: {kind!r}")
