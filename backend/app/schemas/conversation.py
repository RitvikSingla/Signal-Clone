"""Conversation read and write shapes."""

from __future__ import annotations

from datetime import datetime

from typing import Literal

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
    label: str | None = None


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
    #: Set once an admin ends the group; the thread then takes no messages.
    ended_at: datetime | None = None
    #: Whether the caller may send here (left, ended, or admins-only).
    can_send: bool = True
    last_activity_at: datetime


Permission = Literal["all", "admins"]


class GroupPermissions(BaseModel):
    add_members: Permission = "all"
    edit_info: Permission = "all"
    send_messages: Permission = "all"
    member_labels: Permission = "all"


class GroupLinkOut(BaseModel):
    enabled: bool
    requires_approval: bool
    #: Only admins see the token; it is the secret that lets people join.
    token: str | None


class JoinRequestOut(BaseModel):
    user: UserPublic
    created_at: datetime


class ConversationDetail(ConversationSummary):
    description: str | None
    created_by: str | None
    members: list[MemberOut]
    permissions: GroupPermissions | None = None
    group_link: GroupLinkOut | None = None
    #: Waiting join requests; listed for admins only.
    join_requests: list[JoinRequestOut] = Field(default_factory=list)


class CreateDirectIn(BaseModel):
    peer_id: str


class CreateGroupIn(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    #: May be empty: Signal lets you create a group and add people later.
    member_ids: list[str] = Field(default_factory=list)
    description: str | None = Field(default=None, max_length=255)
    avatar_url: str | None = Field(default=None, max_length=255)
    disappearing_seconds: int = Field(default=0, ge=0, le=31_536_000)


class UpdateConversationIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    description: str | None = Field(default=None, max_length=255)
    avatar_color: str | None = Field(default=None, max_length=8)
    avatar_url: str | None = Field(default=None, max_length=255)
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


class UpdatePermissionsIn(BaseModel):
    add_members: Permission | None = None
    edit_info: Permission | None = None
    send_messages: Permission | None = None
    member_labels: Permission | None = None


class UpdateGroupLinkIn(BaseModel):
    enabled: bool | None = None
    requires_approval: bool | None = None
    #: Replace the token, invalidating every copy of the old link.
    reset: bool = False


class SetLabelIn(BaseModel):
    #: Empty or null clears the label.
    label: str | None = Field(default=None, max_length=24)


class JoinPreviewOut(BaseModel):
    """What someone holding a link sees before joining."""

    conversation_id: str
    title: str
    avatar_url: str | None
    avatar_color: str
    member_count: int
    description: str | None
    requires_approval: bool
    #: "member" (already in), "requested" (waiting), or "none".
    status: Literal["member", "requested", "none"]


class JoinResultOut(BaseModel):
    conversation_id: str
    status: Literal["joined", "requested", "member"]


class ResolveRequestIn(BaseModel):
    approve: bool
