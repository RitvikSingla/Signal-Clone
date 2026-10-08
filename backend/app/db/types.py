"""Custom column types.

SQLite has no timestamp type. SQLAlchemy stores a DATETIME as a string and,
crucially, does not round-trip the timezone: you write an aware datetime and
read back a naive one, which then explodes the first time you compare it to
`datetime.now(timezone.utc)`.

UtcDateTime fixes that in one place rather than at every call site:

  write  normalise to UTC, store naive so the stored string stays sortable
         and string comparison in raw SQL still orders correctly
  read   re-attach UTC

Storing naive-UTC rather than an offset string is deliberate. Index range
scans and the ORDER BY on last_activity_at both rely on lexical ordering of
the stored text, and a mix of offsets would break that.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime
from sqlalchemy.engine import Dialect
from sqlalchemy.types import TypeDecorator


class UtcDateTime(TypeDecorator[datetime]):
    impl = DateTime
    cache_ok = True

    def process_bind_param(
        self, value: datetime | None, dialect: Dialect
    ) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            # A naive value reaching the database is a bug upstream, but
            # assuming UTC is safer than storing it in an unknown zone.
            return value
        return value.astimezone(timezone.utc).replace(tzinfo=None)

    def process_result_value(
        self, value: datetime | None, dialect: Dialect
    ) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
