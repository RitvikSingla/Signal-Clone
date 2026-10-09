"""message actions: forward, pin, delete for me

Adds what the message menu needs: an is_forwarded flag, pin state, a typed
event on system rows (so "You pinned a message" can link to its target), and
a message_hides table for Delete for me.

Columns are added with plain ADD COLUMN rather than a batch rebuild. A
rebuild would recreate the messages table and silently drop the three FTS5
triggers that keep search in step, which is why pinned_by_id has no foreign
key at the database level.

Revision ID: b7c1d2e3f4a5
Revises: f4f23fa878da
Create Date: 2026-10-09 10:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7c1d2e3f4a5"
down_revision: Union[str, None] = "f4f23fa878da"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "messages",
        sa.Column("is_forwarded", sa.Boolean(), server_default=sa.text("0"), nullable=False),
    )
    op.add_column("messages", sa.Column("event", sa.String(length=20), nullable=True))
    op.add_column("messages", sa.Column("pinned_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "messages", sa.Column("pin_expires_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column("messages", sa.Column("pinned_by_id", sa.String(length=36), nullable=True))
    op.create_index(
        "ix_messages_pinned",
        "messages",
        ["conversation_id", "pinned_at"],
        sqlite_where=sa.text("pinned_at IS NOT NULL"),
    )

    op.create_table(
        "message_hides",
        sa.Column("message_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(
            ["message_id"],
            ["messages.id"],
            name=op.f("fk_message_hides_message_id_messages"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_message_hides_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_message_hides")),
        sa.UniqueConstraint("message_id", "user_id", name="uq_message_hides_pair"),
    )
    op.create_index(op.f("ix_message_hides_message_id"), "message_hides", ["message_id"])
    op.create_index(op.f("ix_message_hides_user_id"), "message_hides", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_message_hides_user_id"), table_name="message_hides")
    op.drop_index(op.f("ix_message_hides_message_id"), table_name="message_hides")
    op.drop_table("message_hides")
    op.drop_index("ix_messages_pinned", table_name="messages")
    # SQLite 3.35+ supports DROP COLUMN directly, which keeps the triggers.
    for column in ("pinned_by_id", "pin_expires_at", "pinned_at", "event", "is_forwarded"):
        op.drop_column("messages", column)
