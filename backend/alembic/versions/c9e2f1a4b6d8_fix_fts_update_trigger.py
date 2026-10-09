"""fix the full-text triggers for messages without a body

The original triggers disagreed about rows whose body is NULL. The insert
and delete triggers skipped them, but the update trigger always issued the
FTS5 'delete' command with the old values. An external-content FTS5 index
must hold an entry for every row of its content table, so for a photo,
sticker or voice note with no caption that 'delete' removed an entry that
was never added, which corrupts the index ("database disk image is
malformed"). Every delivery or read tick on such a message is an UPDATE, so
attachments made this reachable in normal use.

The triggers now follow the pattern in the SQLite FTS5 documentation: every
row is indexed (a NULL body indexes as empty) and every row is removed on
delete. The update trigger fires only when the body itself changes, since
status ticks do not touch indexed text. The index is then rebuilt from the
messages table, which repairs a database already damaged by the old ones.

Revision ID: c9e2f1a4b6d8
Revises: b7c1d2e3f4a5
Create Date: 2026-10-09 11:40:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "c9e2f1a4b6d8"
down_revision: Union[str, None] = "b7c1d2e3f4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for name in ("messages_fts_insert", "messages_fts_delete", "messages_fts_update"):
        op.execute(f"DROP TRIGGER IF EXISTS {name}")

    op.execute(
        """
        CREATE TRIGGER messages_fts_insert AFTER INSERT ON messages
        BEGIN
            INSERT INTO messages_fts(rowid, body) VALUES (new.rowid, new.body);
        END
        """
    )
    op.execute(
        """
        CREATE TRIGGER messages_fts_delete AFTER DELETE ON messages
        BEGIN
            INSERT INTO messages_fts(messages_fts, rowid, body)
            VALUES ('delete', old.rowid, old.body);
        END
        """
    )
    op.execute(
        """
        CREATE TRIGGER messages_fts_update AFTER UPDATE OF body ON messages
        BEGIN
            INSERT INTO messages_fts(messages_fts, rowid, body)
            VALUES ('delete', old.rowid, old.body);
            INSERT INTO messages_fts(rowid, body) VALUES (new.rowid, new.body);
        END
        """
    )
    # Rebuild from the content table: repairs any index the old triggers broke.
    op.execute("INSERT INTO messages_fts(messages_fts) VALUES ('rebuild')")


def downgrade() -> None:
    for name in ("messages_fts_insert", "messages_fts_delete", "messages_fts_update"):
        op.execute(f"DROP TRIGGER IF EXISTS {name}")

    op.execute(
        """
        CREATE TRIGGER messages_fts_insert AFTER INSERT ON messages
        WHEN new.body IS NOT NULL
        BEGIN
            INSERT INTO messages_fts(rowid, body) VALUES (new.rowid, new.body);
        END
        """
    )
    op.execute(
        """
        CREATE TRIGGER messages_fts_delete AFTER DELETE ON messages
        WHEN old.body IS NOT NULL
        BEGIN
            INSERT INTO messages_fts(messages_fts, rowid, body)
            VALUES ('delete', old.rowid, old.body);
        END
        """
    )
    op.execute(
        """
        CREATE TRIGGER messages_fts_update AFTER UPDATE ON messages
        BEGIN
            INSERT INTO messages_fts(messages_fts, rowid, body)
            VALUES ('delete', old.rowid, old.body);
            INSERT INTO messages_fts(rowid, body)
            SELECT new.rowid, new.body WHERE new.body IS NOT NULL;
        END
        """
    )
    op.execute("INSERT INTO messages_fts(messages_fts) VALUES ('rebuild')")
