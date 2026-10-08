"""The connection registry.

One account can hold several sockets at once, which is how Signal behaves
across several devices. The hub therefore maps an account id to a *set* of
sockets rather than to one, and "is this person online" means "do they hold
at least one socket".

The hub is a transport. It knows nothing about conversations or permissions;
callers decide who should receive a frame and the hub delivers it.
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

from app.realtime.events import ServerEvent

logger = logging.getLogger(__name__)


class Hub:
    def __init__(self) -> None:
        self._sockets: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    # -- registry --------------------------------------------------------

    async def register(self, user_id: str, socket: WebSocket) -> bool:
        """Add a socket. Returns True if this is the account's first one."""
        async with self._lock:
            was_offline = not self._sockets[user_id]
            self._sockets[user_id].add(socket)
            return was_offline

    async def unregister(self, user_id: str, socket: WebSocket) -> bool:
        """Remove a socket. Returns True if the account has none left."""
        async with self._lock:
            self._sockets[user_id].discard(socket)
            if not self._sockets[user_id]:
                del self._sockets[user_id]
                return True
            return False

    def is_online(self, user_id: str) -> bool:
        return bool(self._sockets.get(user_id))

    def online_user_ids(self) -> set[str]:
        return set(self._sockets.keys())

    def connection_count(self) -> int:
        return sum(len(sockets) for sockets in self._sockets.values())

    # -- delivery --------------------------------------------------------

    async def send_to_user(self, user_id: str, payload: dict[str, Any]) -> None:
        """Deliver to every socket this account holds.

        A socket that fails is dropped rather than retried: the client will
        reconnect and replay, and blocking the sender on a dead peer would
        be worse than losing one frame.
        """
        sockets = list(self._sockets.get(user_id, ()))
        if not sockets:
            return

        dead: list[WebSocket] = []
        for socket in sockets:
            try:
                await socket.send_json(payload)
            except Exception:  # noqa: BLE001 - any failure means the peer is gone
                dead.append(socket)

        for socket in dead:
            await self.unregister(user_id, socket)

    async def send_to_users(
        self,
        user_ids: list[str] | set[str],
        payload: dict[str, Any],
        *,
        exclude: str | None = None,
    ) -> None:
        targets = [uid for uid in set(user_ids) if uid != exclude]
        if not targets:
            return
        await asyncio.gather(
            *(self.send_to_user(uid, payload) for uid in targets),
            return_exceptions=True,
        )

    async def send_error(self, socket: WebSocket, message: str) -> None:
        try:
            await socket.send_json({"type": ServerEvent.ERROR, "detail": message})
        except Exception:  # noqa: BLE001
            pass


#: One hub per process. SQLite and a single web service mean one process is
#: the whole deployment; a multi-process deployment would need the sockets
#: backed by a shared broker instead, which is noted in the README.
hub = Hub()
