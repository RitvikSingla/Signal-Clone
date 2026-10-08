"""Threads and membership.

One table serves both direct and group conversations. Almost everything about
a thread is identical either way: members, messages, last activity, read
cursors, mute and pin state. Splitting them would duplicate all of it and
force every list query to union two tables.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, utcnow
from app.models.enums import ConversationType, MemberRole

if TYPE_CHECKING:
    from app.models.message import Message
    from app.models.user import User


def build_dm_key(user_a_id: str, user_b_id: str) -> str:
    """Order-independent key for a pair.

    Sorting before joining is what makes the unique index meaningful: without
    it, (alice, bob) and (bob, alice) would be two different keys and the pair
    could end up with two direct threads.
    """
    first, second = sorted((user_a_id, user_b_id))
    return f"{first}:{second}"


class Conversation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "conversations"
    __table_args__ = (
        CheckConstraint(
            "type IN ('direct', 'group')", name="conversation_type_known"
        ),
        # A direct thread must carry a dm_key; a group must not. This is the
        # one structural difference between the two types.
        CheckConstraint(
            "(type = 'direct' AND dm_key IS NOT NULL) OR "
            "(type = 'group' AND dm_key IS NULL)",
            name="dm_key_only_for_direct",
        ),
        Index("ix_conversations_last_activity", "last_activity_at"),
    )

    type: Mapped[ConversationType] = mapped_column(String(10))

    # Group-only. A direct thread takes its name and avatar from the peer,
    # which is why these are nullable rather than duplicated per member.
    name: Mapped[str | None] = mapped_column(String(64))
    description: Mapped[str | None] = mapped_column(String(255))
    avatar_url: Mapped[str | None] = mapped_column(String(255))
    avatar_color: Mapped[str] = mapped_column(String(8), default="A200")

    #: Sorted pair of account ids, unique. Enforces one direct thread per pair.
    dm_key: Mapped[str | None] = mapped_column(String(80), unique=True, index=True)

    created_by: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    #: Zero means off. Applies to messages created after it is set, never
    #: retroactively, which is how Signal behaves.
    disappearing_seconds: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )

    #: Denormalised so the conversation list renders without a correlated
    #: subquery per row. Kept in sync by the message service.
    last_message_id: Mapped[str | None] = mapped_column(
        ForeignKey("messages.id", ondelete="SET NULL", use_alter=True)
    )
    last_activity_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    members: Mapped[list[ConversationMember]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )
    messages: Mapped[list[Message]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        foreign_keys="Message.conversation_id",
    )
    last_message: Mapped[Message | None] = relationship(
        foreign_keys=[last_message_id], post_update=True
    )

    @property
    def is_group(self) -> bool:
        return self.type == ConversationType.GROUP

    def __repr__(self) -> str:
        return f"<Conversation {self.type} {self.name or self.dm_key}>"


class ConversationMember(UUIDPrimaryKeyMixin, Base):
    """Membership, plus everything that is per person rather than per thread.

    Pin, mute, archive and the read cursor all live here because they differ
    between two people looking at the same conversation.
    """

    __tablename__ = "conversation_members"
    __table_args__ = (
        UniqueConstraint(
            "conversation_id", "user_id", name="uq_conversation_members_pair"
        ),
        CheckConstraint("role IN ('admin', 'member')", name="member_role_known"),
    )

    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[MemberRole] = mapped_column(String(10), default=MemberRole.MEMBER)

    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    #: Soft leave. History stays attributable to someone who has left.
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    #: The read cursor. Unread count is derived by counting messages created
    #: after this one, so opening a thread is a single-row update no matter
    #: how many messages were unread.
    last_read_message_id: Mapped[str | None] = mapped_column(
        ForeignKey("messages.id", ondelete="SET NULL", use_alter=True)
    )

    muted_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    conversation: Mapped[Conversation] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="memberships")

    @property
    def is_active(self) -> bool:
        return self.left_at is None

    @property
    def is_admin(self) -> bool:
        return self.role == MemberRole.ADMIN
