"""Closed vocabularies used across the schema.

Stored as short strings rather than native database enums, because SQLite has
no ENUM type and a CHECK constraint on a VARCHAR is both portable and visible
in the schema dump.
"""

from enum import StrEnum


class ConversationType(StrEnum):
    DIRECT = "direct"
    GROUP = "group"


class MemberRole(StrEnum):
    ADMIN = "admin"
    MEMBER = "member"


class MessageType(StrEnum):
    TEXT = "text"
    IMAGE = "image"
    FILE = "file"
    #: Membership changes, timer changes and similar. Rendered centred, with
    #: no bubble and no sender.
    SYSTEM = "system"


class MessageStatus(StrEnum):
    """Sender-side rollup over message_receipts.

    SENDING exists only in the client's optimistic state; a row that reaches
    the database is at least SENT.
    """

    SENDING = "sending"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"


class DevicePlatform(StrEnum):
    DESKTOP = "desktop"
    IOS = "ios"
    ANDROID = "android"


#: Signal assigns every contact without a photo one of these, keyed off the
#: account, so a list of people with no avatars still reads as distinct rows.
AVATAR_COLORS: tuple[str, ...] = (
    "A100",
    "A110",
    "A120",
    "A130",
    "A140",
    "A150",
    "A160",
    "A170",
    "A180",
    "A190",
    "A200",
    "A210",
)
