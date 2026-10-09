"""Accounts, their linked devices, and the directed address book."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, utcnow
from app.db.types import UtcDateTime
from app.models.enums import DevicePlatform

if TYPE_CHECKING:
    from app.models.auth import AuthSession
    from app.models.conversation import ConversationMember
    from app.models.message import Message


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One row per registered account."""

    __tablename__ = "users"

    # --- identity -------------------------------------------------------
    phone_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    username: Mapped[str | None] = mapped_column(String(32), unique=True, index=True)

    # --- profile --------------------------------------------------------
    display_name: Mapped[str] = mapped_column(String(64))
    about: Mapped[str | None] = mapped_column(String(140))
    avatar_url: Mapped[str | None] = mapped_column(String(255))
    #: One of AVATAR_COLORS. Used when avatar_url is null, which is the
    #: common case, so initials render on a stable per-account colour.
    avatar_color: Mapped[str] = mapped_column(String(8), default="A210")

    # --- simulated cryptography ----------------------------------------
    #: Random, not derived from a real key exchange. Feeds the safety-number
    #: screen so the UI has something stable and per-account to display.
    identity_key: Mapped[str] = mapped_column(String(64))
    registration_id: Mapped[int] = mapped_column(Integer)

    # --- presence -------------------------------------------------------
    #: Written by the WebSocket hub on connect and disconnect, not faked.
    is_online: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(
        UtcDateTime, default=utcnow, nullable=False
    )

    # --- relationships --------------------------------------------------
    devices: Mapped[list[Device]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    sessions: Mapped[list[AuthSession]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    memberships: Mapped[list[ConversationMember]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    sent_messages: Mapped[list[Message]] = relationship(
        back_populates="sender", foreign_keys="Message.sender_id"
    )
    #: Entries this account owns, i.e. "my contacts".
    contacts: Mapped[list[Contact]] = relationship(
        back_populates="owner",
        foreign_keys="Contact.owner_id",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<User {self.display_name} {self.phone_number}>"


class Device(UUIDPrimaryKeyMixin, Base):
    """Backs the Linked Devices screen with real rows rather than a static mock."""

    __tablename__ = "devices"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(64))
    platform: Mapped[DevicePlatform] = mapped_column(String(16))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_active_at: Mapped[datetime] = mapped_column(
        UtcDateTime, default=utcnow, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        UtcDateTime, default=utcnow, nullable=False
    )

    user: Mapped[User] = relationship(back_populates="devices")


class Contact(UUIDPrimaryKeyMixin, Base):
    """A directed edge in the address book.

    Directed on purpose: adding someone does not add you to their list, and a
    nickname is a local override that never touches the other account.
    """

    __tablename__ = "contacts"
    __table_args__ = (
        UniqueConstraint("owner_id", "contact_user_id", name="uq_contacts_owner_target"),
    )

    owner_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    contact_user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    #: Nickname first name; with nickname_family it replaces their profile
    #: name for the owner only.
    nickname: Mapped[str | None] = mapped_column(String(64))
    nickname_family: Mapped[str | None] = mapped_column(String(64))
    #: A private note, visible only to the owner.
    note: Mapped[str | None] = mapped_column(String(240))
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        UtcDateTime, default=utcnow, nullable=False
    )

    owner: Mapped[User] = relationship(back_populates="contacts", foreign_keys=[owner_id])
    contact_user: Mapped[User] = relationship(foreign_keys=[contact_user_id])
