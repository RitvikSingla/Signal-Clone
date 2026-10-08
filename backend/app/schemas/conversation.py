"""Conversation read and write shapes."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import ConversationType, MemberRole
from app.schemas.common import ORMModel, UserPublic
from app.schemas.message import MessagePreview


class MemberOut(BaseModel):
    user: UserPublic
    role: MemberRole
    joined_at: datetime
    left_at: datetime | None
    is_active: bool


class ConversationSummary(BaseModel):
    """One row in the conversation list.

    Everything the row needs is here, so rendering the list costs no further
    requests: title and avatar already resolved for direct threads, the last
    message preview, and the caller's own unread count and preferences.
    """

    id: str
    type: ConversationType
    title: str
    avatar_url: str | None
    avatar_color: str
    #: Null for a group. For a direct thread this is the other person, which
    #: is where the row's name, avatar and presence come from.
    peer: UserPublic | None
    last_message: MessagePreview | None
    unread_count: int
    member_count: int
    my_role: MemberRole
    is_pinned: bool
    is_archived: bool
    is_muted: bool
    disappearing_seconds: int
    last_activity_at: datetime


class ConversationDetail(ConversationSummary):
    description: str | None
    created_by: str | None
    members: list[MemberOut]


class CreateDirectIn(BaseModel):
    peer_id: str


class CreateGroupIn(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    member_ids: list[str] = Field(min_length=1)
    description: str | None = Field(default=None, max_length=255)


class UpdateConversationIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    description: str | None = Field(default=None, max_length=255)
    avatar_color: str | None = Field(default=None, max_length=8)
    disappearing_seconds: int | None = Field(default=None, ge=0, le=31_536_000)


class UpdatePrefsIn(BaseModel):
    """Per-person thread settings. Never visible to the other members."""

    is_pinned: bool | None = None
    is_archived: bool | None = None
    muted_until: datetime | None = None


class AddMembersIn(BaseModel):
    user_ids: list[str] = Field(min_length=1)


class ChangeRoleIn(BaseModel):
    role: MemberRole


class MarkReadIn(BaseModel):
    #: Null means "everything currently in the thread".
    last_message_id: str | None = None


class MarkReadOut(ORMModel):
    conversation_id: str
    unread_count: int
    last_read_message_id: str | None
