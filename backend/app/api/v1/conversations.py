"""Conversation and membership endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.core.deps import DbSession, RegisteredUser
from app.models.enums import MemberRole
from app.schemas.common import Message as MessageAck
from app.schemas.conversation import (
    AddMembersIn,
    ChangeRoleIn,
    ConversationDetail,
    ConversationSummary,
    CreateDirectIn,
    CreateGroupIn,
    JoinPreviewOut,
    JoinResultOut,
    MarkReadIn,
    MarkReadOut,
    ResolveRequestIn,
    SetLabelIn,
    UpdateConversationIn,
    UpdateGroupLinkIn,
    UpdatePermissionsIn,
    UpdatePrefsIn,
)
from app.schemas.message import MessageOut, MessagePage, SendMessageIn
from app.realtime import broadcast
from app.services import conversation_service, message_service
from app.services.conversation_service import ConversationError

router = APIRouter(prefix="/conversations", tags=["conversations"])


def _fail(exc: ConversationError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("", response_model=list[ConversationSummary])
async def list_conversations(
    user: RegisteredUser,
    db: DbSession,
    unread_only: Annotated[bool, Query()] = False,
    archived: Annotated[bool, Query()] = False,
    search: Annotated[str | None, Query(max_length=100)] = None,
) -> list[ConversationSummary]:
    """Threads sorted by pin, then by most recent activity."""
    return await conversation_service.list_conversations(
        db, user, unread_only=unread_only, archived=archived, search=search
    )


@router.post("/direct", response_model=ConversationDetail)
async def create_direct(
    payload: CreateDirectIn, user: RegisteredUser, db: DbSession, response: Response
) -> ConversationDetail:
    """Open the thread with one person, creating it only if it is absent."""
    try:
        detail, created = await conversation_service.create_direct(
            db, user, payload.peer_id
        )
    except ConversationError as exc:
        raise _fail(exc) from exc
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return detail


@router.post("/group", response_model=ConversationDetail, status_code=201)
async def create_group(
    payload: CreateGroupIn, user: RegisteredUser, db: DbSession
) -> ConversationDetail:
    try:
        detail = await conversation_service.create_group(
            db,
            user,
            payload.name,
            payload.member_ids,
            payload.description,
            avatar_url=payload.avatar_url,
            disappearing_seconds=payload.disappearing_seconds,
        )
    except ConversationError as exc:
        raise _fail(exc) from exc
    db.info.pop("system_messages", None)  # nobody has the thread open yet
    await broadcast.conversation_updated(db, detail.id)
    return detail


# --- group link (declared before /{conversation_id} routes) -----------------


@router.get("/group-link/{token}", response_model=JoinPreviewOut)
async def preview_group_link(token: str, user: RegisteredUser, db: DbSession) -> JoinPreviewOut:
    """What the group looks like to someone holding its link."""
    try:
        return await conversation_service.preview_join(db, user, token)
    except ConversationError as exc:
        raise _fail(exc) from exc


@router.post("/group-link/{token}", response_model=JoinResultOut)
async def join_group_link(token: str, user: RegisteredUser, db: DbSession) -> JoinResultOut:
    """Join, or ask to join when the link requires admin approval."""
    try:
        conversation_id, result = await conversation_service.join_by_link(db, user, token)
    except ConversationError as exc:
        raise _fail(exc) from exc
    await broadcast.system_messages(db, conversation_id)
    await broadcast.conversation_updated(db, conversation_id)
    return JoinResultOut(conversation_id=conversation_id, status=result)


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: str, user: RegisteredUser, db: DbSession
) -> ConversationDetail:
    try:
        return await conversation_service.get_conversation(db, user, conversation_id)
    except ConversationError as exc:
        raise _fail(exc) from exc


@router.patch("/{conversation_id}", response_model=ConversationDetail)
async def update_conversation(
    conversation_id: str,
    payload: UpdateConversationIn,
    user: RegisteredUser,
    db: DbSession,
) -> ConversationDetail:
    try:
        detail = await conversation_service.update_conversation(
            db,
            user,
            conversation_id,
            name=payload.name,
            description=payload.description,
            avatar_color=payload.avatar_color,
            disappearing_seconds=payload.disappearing_seconds,
            avatar_url=payload.avatar_url,
        )
    except ConversationError as exc:
        raise _fail(exc) from exc
    await broadcast.system_messages(db, conversation_id)
    await broadcast.conversation_updated(db, conversation_id)
    return detail


@router.patch("/{conversation_id}/prefs", response_model=ConversationSummary)
async def update_prefs(
    conversation_id: str, payload: UpdatePrefsIn, user: RegisteredUser, db: DbSession
) -> ConversationSummary:
    """Pin, mute and archive. Scoped to the caller, invisible to everyone else."""
    try:
        return await conversation_service.update_prefs(
            db,
            user,
            conversation_id,
            is_pinned=payload.is_pinned,
            is_archived=payload.is_archived,
            muted_until=payload.muted_until,
            set_mute="muted_until" in payload.model_fields_set,
        )
    except ConversationError as exc:
        raise _fail(exc) from exc


@router.post("/{conversation_id}/read", response_model=MarkReadOut)
async def mark_read(
    conversation_id: str, payload: MarkReadIn, user: RegisteredUser, db: DbSession
) -> MarkReadOut:
    """Advance the read cursor and promote the senders' check marks."""
    try:
        membership, touched = await conversation_service.mark_read(
            db, user, conversation_id, payload.last_message_id
        )
        changed = await message_service.refresh_statuses(db, touched)
        await broadcast.statuses_changed(db, changed)
    except ConversationError as exc:
        raise _fail(exc) from exc

    return MarkReadOut(
        conversation_id=conversation_id,
        unread_count=0,
        last_read_message_id=membership.last_read_message_id,
    )


# --- membership ------------------------------------------------------------


@router.post("/{conversation_id}/members", response_model=ConversationDetail)
async def add_members(
    conversation_id: str, payload: AddMembersIn, user: RegisteredUser, db: DbSession
) -> ConversationDetail:
    """Admin only."""
    try:
        detail = await conversation_service.add_members(
            db, user, conversation_id, payload.user_ids
        )
    except ConversationError as exc:
        raise _fail(exc) from exc
    await broadcast.system_messages(db, conversation_id)
    await broadcast.conversation_updated(db, conversation_id)
    return detail


@router.patch("/{conversation_id}/members/{member_id}", response_model=ConversationDetail)
async def change_role(
    conversation_id: str,
    member_id: str,
    payload: ChangeRoleIn,
    user: RegisteredUser,
    db: DbSession,
) -> ConversationDetail:
    """Admin only. A group may never be left without an admin."""
    try:
        detail = await conversation_service.change_role(
            db, user, conversation_id, member_id, MemberRole(payload.role)
        )
    except ConversationError as exc:
        raise _fail(exc) from exc
    await broadcast.system_messages(db, conversation_id)
    await broadcast.conversation_updated(db, conversation_id)
    return detail


@router.delete("/{conversation_id}/members/{member_id}", response_model=ConversationDetail)
async def remove_member(
    conversation_id: str, member_id: str, user: RegisteredUser, db: DbSession
) -> ConversationDetail:
    """Admin only."""
    try:
        detail = await conversation_service.remove_member(
            db, user, conversation_id, member_id
        )
    except ConversationError as exc:
        raise _fail(exc) from exc
    # The removed person hears about it too, so their thread updates.
    await broadcast.system_messages(db, conversation_id, also_notify=[member_id])
    await broadcast.conversation_updated(db, conversation_id)
    return detail


@router.post("/{conversation_id}/leave", response_model=MessageAck)
async def leave(conversation_id: str, user: RegisteredUser, db: DbSession) -> MessageAck:
    try:
        await conversation_service.leave(db, user, conversation_id)
    except ConversationError as exc:
        raise _fail(exc) from exc
    await broadcast.system_messages(db, conversation_id, also_notify=[user.id])
    await broadcast.conversation_updated(db, conversation_id)
    return MessageAck(detail="You left the group.")


# --- group settings ----------------------------------------------------------


@router.patch("/{conversation_id}/permissions", response_model=ConversationDetail)
async def update_permissions(
    conversation_id: str, payload: UpdatePermissionsIn, user: RegisteredUser, db: DbSession
) -> ConversationDetail:
    """Admin only. Each permission is "all" or "admins"."""
    try:
        detail = await conversation_service.update_permissions(
            db, user, conversation_id, payload.model_dump(exclude_none=True)
        )
    except ConversationError as exc:
        raise _fail(exc) from exc
    await broadcast.system_messages(db, conversation_id)
    await broadcast.conversation_updated(db, conversation_id)
    return detail


@router.patch("/{conversation_id}/link", response_model=ConversationDetail)
async def update_group_link(
    conversation_id: str, payload: UpdateGroupLinkIn, user: RegisteredUser, db: DbSession
) -> ConversationDetail:
    """Admin only: turn the link on or off, require approval, or reset it."""
    try:
        detail = await conversation_service.update_group_link(
            db,
            user,
            conversation_id,
            enabled=payload.enabled,
            requires_approval=payload.requires_approval,
            reset=payload.reset,
        )
    except ConversationError as exc:
        raise _fail(exc) from exc
    await broadcast.system_messages(db, conversation_id)
    await broadcast.conversation_updated(db, conversation_id)
    return detail


@router.put("/{conversation_id}/label", response_model=ConversationDetail)
async def set_label(
    conversation_id: str, payload: SetLabelIn, user: RegisteredUser, db: DbSession
) -> ConversationDetail:
    """The caller's own member label in this group."""
    try:
        detail = await conversation_service.set_label(db, user, conversation_id, payload.label)
    except ConversationError as exc:
        raise _fail(exc) from exc
    await broadcast.conversation_updated(db, conversation_id)
    return detail


@router.post("/{conversation_id}/requests/{requester_id}", response_model=ConversationDetail)
async def resolve_request(
    conversation_id: str,
    requester_id: str,
    payload: ResolveRequestIn,
    user: RegisteredUser,
    db: DbSession,
) -> ConversationDetail:
    """Admin only: approve or deny someone who asked to join via the link."""
    try:
        detail = await conversation_service.resolve_request(
            db, user, conversation_id, requester_id, payload.approve
        )
    except ConversationError as exc:
        raise _fail(exc) from exc
    await broadcast.system_messages(
        db, conversation_id, also_notify=[requester_id] if not payload.approve else None
    )
    await broadcast.conversation_updated(db, conversation_id)
    return detail


@router.post("/{conversation_id}/end", response_model=ConversationDetail)
async def end_group(
    conversation_id: str, user: RegisteredUser, db: DbSession
) -> ConversationDetail:
    """Admin only. Nobody can send to the group afterwards; history stays."""
    try:
        detail = await conversation_service.end_group(db, user, conversation_id)
    except ConversationError as exc:
        raise _fail(exc) from exc
    await broadcast.system_messages(db, conversation_id)
    await broadcast.conversation_updated(db, conversation_id)
    return detail


@router.post("/{conversation_id}/clear", response_model=MessageAck)
async def clear_history(
    conversation_id: str, user: RegisteredUser, db: DbSession
) -> MessageAck:
    """Delete the chat for the caller only: every message is hidden for them."""
    try:
        count = await conversation_service.clear_history(db, user, conversation_id)
    except ConversationError as exc:
        raise _fail(exc) from exc
    return MessageAck(detail=f"Deleted {count} messages for you.")


# --- messages within a conversation ---------------------------------------


@router.get("/{conversation_id}/messages", response_model=MessagePage)
async def list_messages(
    conversation_id: str,
    user: RegisteredUser,
    db: DbSession,
    before: Annotated[str | None, Query(description="Message id to page back from")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 40,
) -> MessagePage:
    """One page of the thread, oldest first within the page."""
    try:
        return await message_service.list_messages(
            db, user, conversation_id, before=before, limit=limit
        )
    except ConversationError as exc:
        raise _fail(exc) from exc


@router.get("/{conversation_id}/pins", response_model=list[MessageOut])
async def list_pins(conversation_id: str, user: RegisteredUser, db: DbSession) -> list[MessageOut]:
    """Live pinned messages, newest first, for the banner under the header."""
    try:
        return await message_service.list_pins(db, user, conversation_id)
    except ConversationError as exc:
        raise _fail(exc) from exc


@router.post("/{conversation_id}/messages", response_model=MessageOut)
async def send_message(
    conversation_id: str,
    payload: SendMessageIn,
    user: RegisteredUser,
    db: DbSession,
    response: Response,
) -> MessageOut:
    """Send. Idempotent on client_id, so a retry never duplicates."""
    try:
        message, created = await message_service.send_message(
            db,
            user,
            conversation_id,
            client_id=payload.client_id,
            body=payload.body,
            reply_to_id=payload.reply_to_id,
            attachment_ids=payload.attachment_ids,
        )
    except ConversationError as exc:
        raise _fail(exc) from exc

    if created:
        await broadcast.message_created(db, message, user.id)

    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return message
