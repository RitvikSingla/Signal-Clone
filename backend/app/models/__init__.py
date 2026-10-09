"""Model package.

Every table is imported here so that `Base.metadata` is complete the moment
this package is imported. Alembic autogenerate and the test fixtures both
depend on that: a model that is never imported is a table that silently goes
missing from the migration.
"""

from app.db.base import Base
from app.models.auth import AuthSession, PhoneVerification
from app.models.conversation import (
    Conversation,
    ConversationMember,
    GroupJoinRequest,
    build_dm_key,
)
from app.models.enums import (
    AVATAR_COLORS,
    ConversationType,
    DevicePlatform,
    MemberRole,
    MessageStatus,
    MessageType,
)
from app.models.message import (
    Attachment,
    Message,
    MessageHide,
    MessageReceipt,
    Reaction,
)
from app.models.user import Contact, Device, User

__all__ = [
    "AVATAR_COLORS",
    "Attachment",
    "AuthSession",
    "Base",
    "Contact",
    "Conversation",
    "ConversationMember",
    "ConversationType",
    "GroupJoinRequest",
    "Device",
    "DevicePlatform",
    "MemberRole",
    "Message",
    "MessageHide",
    "MessageReceipt",
    "MessageStatus",
    "MessageType",
    "PhoneVerification",
    "Reaction",
    "User",
    "build_dm_key",
]
