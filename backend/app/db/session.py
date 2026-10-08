"""Async engine, session factory and the FastAPI dependency.

The pragmas are the interesting part. SQLite defaults are wrong for an app that
holds a WebSocket open while writing:

  foreign_keys   off by default, which would silently allow orphan rows
  journal_mode   the default rollback journal blocks readers during a write;
                 WAL lets the hub keep reading while a message is inserted
  busy_timeout   without it a concurrent write raises immediately instead of
                 waiting the few milliseconds the other transaction needs
"""

from collections.abc import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=False,
    future=True,
    # SQLite with aiosqlite runs each connection on a worker thread; the
    # default pool is fine, but a short recycle avoids stale handles after a
    # host suspends the process.
    pool_recycle=3600,
)


@event.listens_for(engine.sync_engine, "connect")
def _apply_sqlite_pragmas(dbapi_connection, _connection_record) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.close()


AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Request-scoped session. Rolls back on an unhandled exception."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
