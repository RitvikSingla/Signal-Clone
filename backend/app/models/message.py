"""Messages and everything hung off them.

The receipts table is the part worth reading twice. A read cursor on the
membership answers "what has this person read", which is what an unread badge
needs. A receipt row answers "who has received and read this specific
message", which is what the sender's check marks need. In a group those are
different questions, and conflating them produces wrong ticks.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPrimaryKeyMixin, utcnow
from app.db.types import UtcDateTime
from app.models.enums import MessageStatus, MessageType

if TYPE_CHECKING:
    from app.models.conversation import Conversation
    from app.models.user import User


class Message(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "messages"
    __table_args__ = (
        # Idempotent send: a retry with the same client id hits this constraint
        # and updates nothing instead of creating a duplicate bubble.
        UniqueConstraint("sender_id", "client_id", name="uq_messages_sender_client"),
        CheckConstraint(
            "type IN ('text', 'image', 'file', 'system')", name="message_type_known"
        ),
        CheckConstraint(
            "status IN ('sending', 'sent', 'delivered', 'read')",
            name="message_status_known",
        ),
        # Thread paging reads newest first within one conversation.
        Index("ix_messages_conversation_created", "conversation_id", "created_at"),
        # Partial index: only rows with a timer are ever swept, so the index
        # stays tiny even though most messages never expire.
        Index(
            "ix_messages_expires_at",
            "expires_at",
            sqlite_where=text("expires_at IS NOT NULL"),
        ),
    )

    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    #: Null for system events such as a member joining, which have no author.
    sender_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )

    type: Mapped[MessageType] = mapped_column(String(10), default=MessageType.TEXT)
    body: Mapped[str | None] = mapped_column(Text)

    #: Derived digest shown on the message-info sheet. Part of the simulated
    #: encryption surface; it protects nothing.
    envelope_hash: Mapped[str] = mapped_column(String(64))

    #: Self join behind the quoted strip. SET NULL rather than cascade, so
    #: deleting a quoted message leaves the reply intact.
    reply_to_id: Mapped[str | None] = mapped_column(
        ForeignKey("messages.id", ondelete="SET NULL")
    )

    #: Sender-side rollup over receipts, cached so the thread renders without
    #: an aggregate query per bubble.
    status: Mapped[MessageStatus] = mapped_column(
        String(10), default=MessageStatus.SENT
    )

    #: Supplied by the client before the request leaves the browser.
    client_id: Mapped[str] = mapped_column(String(36))

    edited_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    #: Soft delete. The row stays so the thread can render a tombstone.
    deleted_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    #: Set at insert time when the thread has a timer running.
    expires_at: Mapped[datetime | None] = mapped_column(UtcDateTime)

    created_at: Mapped[datetime] = mapped_column(
        UtcDateTime, default=utcnow, nullable=False
    )

    conversation: Mapped[Conversation] = relationship(
        back_populates="messages", foreign_keys=[conversation_id]
    )
    sender: Mapped[User | None] = relationship(
        back_populates="sent_messages", foreign_keys=[sender_id]
    )
    reply_to: Mapped[Message | None] = relationship(
        remote_side="Message.id", foreign_keys=[reply_to_id]
    )
    receipts: Mapped[list[MessageReceipt]] = relationship(
        back_populates="message", cascade="all, delete-orphan"
    )
    reactions: Mapped[list[Reaction]] = relationship(
        back_populates="message", cascade="all, delete-orphan"
    )
    attachments: Mapped[list[Attachment]] = relationship(
        back_populates="message", cascade="all, delete-orphan"
    )

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    def __repr__(self) -> str:
        preview = (self.body or "")[:24]
        return f"<Message {self.type} {preview!r}>"


class MessageReceipt(UUIDPrimaryKeyMixin, Base):
    """One row per recipient per message. Never for the sender."""

    __tablename__ = "message_receipts"
    __table_args__ = (
        UniqueConstraint("message_id", "user_id", name="uq_message_receipts_pair"),
    )

    message_id: Mapped[str] = mapped_column(
        ForeignKey("messages.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    #: Written when the recipient's socket acknowledges arrival.
    delivered_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    #: Written when that member's read cursor passes this message.
    read_at: Mapped[datetime | None] = mapped_column(UtcDateTime)

    message: Mapped[Message] = relationship(back_populates="receipts")
    user: Mapped[User] = relationship()


class Reaction(UUIDPrimaryKeyMixin, Base):
    """One emoji per person per message, which is how Signal behaves.

    Reacting again replaces the emoji on the existing row rather than adding
    a second one, which is what the unique constraint encodes.
    """

    __tablename__ = "reactions"
    __table_args__ = (
        UniqueConstraint("message_id", "user_id", name="uq_reactions_pair"),
    )

    message_id: Mapped[str] = mapped_column(
        ForeignKey("messages.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    emoji: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(
        UtcDateTime, default=utcnow, nullable=False
    )

    message: Mapped[Message] = relationship(back_populates="reactions")
    user: Mapped[User] = relationship()


class Attachment(UUIDPrimaryKeyMixin, Base):
    """Files and images.

    message_id is nullable because upload happens before send: the client
    uploads, gets an id back, then includes it in the message body request.
    An attachment with no message after a while is an abandoned upload.
    """

    __tablename__ = "attachments"

    message_id: Mapped[str | None] = mapped_column(
        ForeignKey("messages.id", ondelete="CASCADE"), index=True
    )
    uploader_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    file_name: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    storage_path: Mapped[str] = mapped_column(String(512))

    #: Known for images, so the bubble can reserve space before the file
    #: loads and the thread does not jump while scrolling.
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    thumbnail_path: Mapped[str | None] = mapped_column(String(512))

    created_at: Mapped[datetime] = mapped_column(
        UtcDateTime, default=utcnow, nullable=False
    )

    message: Mapped[Message | None] = relationship(back_populates="attachments")
    uploader: Mapped[User] = relationship()
