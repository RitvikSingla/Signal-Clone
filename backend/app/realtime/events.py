"""The wire protocol.

Every frame is a JSON object with a `type` field. Names are namespaced with
a dot so the client can route on a prefix, and they are listed here rather
than written as string literals at each call site, which is what keeps the
two ends from drifting.
"""

from enum import StrEnum


class ClientEvent(StrEnum):
    """Frames the browser sends."""

    #: Keepalive. The server answers with PONG.
    PING = "ping"
    TYPING_START = "typing.start"
    TYPING_STOP = "typing.stop"
    #: "These messages reached me." Fills delivered_at on their receipts.
    MESSAGE_DELIVERED = "message.delivered"


class ServerEvent(StrEnum):
    """Frames the server sends."""

    #: Sent once on connect, carrying the account id the token resolved to.
    CONNECTED = "connected"
    PONG = "pong"

    MESSAGE_NEW = "message.new"
    MESSAGE_UPDATED = "message.updated"
    #: A sender's own bubble moved between sent, delivered and read.
    MESSAGE_STATUS = "message.status"
    #: Disappearing messages whose timer ran out; clients drop them.
    MESSAGE_EXPIRED = "message.expired"

    TYPING = "typing"
    PRESENCE = "presence"

    CONVERSATION_UPDATED = "conversation.updated"

    ERROR = "error"
