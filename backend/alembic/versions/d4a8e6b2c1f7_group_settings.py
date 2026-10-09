"""group settings: link, permissions, labels, end group, join requests

Columns are added with plain ADD COLUMN (no batch rebuild), for the same
reason as b7c1d2e3f4a5: a rebuild of a table SQLite cannot ALTER in place
would drop triggers and indexes defined outside SQLAlchemy. The unique
token is enforced with a separate unique index, since SQLite cannot add a
UNIQUE column.

Revision ID: d4a8e6b2c1f7
Revises: c9e2f1a4b6d8
Create Date: 2026-10-09 12:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4a8e6b2c1f7"
down_revision: Union[str, None] = "c9e2f1a4b6d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PERMISSIONS = ("perm_add_members", "perm_edit_info", "perm_send_messages", "perm_member_labels")


def upgrade() -> None:
    op.add_column("conversations", sa.Column("link_token", sa.String(length=43), nullable=True))
    op.add_column(
        "conversations",
        sa.Column("link_enabled", sa.Boolean(), server_default=sa.text("0"), nullable=False),
    )
    op.add_column(
        "conversations",
        sa.Column(
            "link_requires_approval", sa.Boolean(), server_default=sa.text("0"), nullable=False
        ),
    )
    for column in PERMISSIONS:
        op.add_column(
            "conversations",
            sa.Column(column, sa.String(length=6), server_default="all", nullable=False),
        )
    op.add_column(
        "conversations", sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_index(
        "uq_conversations_link_token", "conversations", ["link_token"], unique=True
    )

    op.add_column(
        "conversation_members", sa.Column("label", sa.String(length=24), nullable=True)
    )

    op.create_table(
        "group_join_requests",
        sa.Column("conversation_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["conversations.id"],
            name=op.f("fk_group_join_requests_conversation_id_conversations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_group_join_requests_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_group_join_requests")),
        sa.UniqueConstraint(
            "conversation_id", "user_id", name="uq_group_join_requests_pair"
        ),
    )
    op.create_index(
        op.f("ix_group_join_requests_conversation_id"),
        "group_join_requests",
        ["conversation_id"],
    )
    op.create_index(
        op.f("ix_group_join_requests_user_id"), "group_join_requests", ["user_id"]
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_group_join_requests_user_id"), table_name="group_join_requests")
    op.drop_index(
        op.f("ix_group_join_requests_conversation_id"), table_name="group_join_requests"
    )
    op.drop_table("group_join_requests")
    op.drop_column("conversation_members", "label")
    op.drop_index("uq_conversations_link_token", table_name="conversations")
    for column in ("ended_at", *PERMISSIONS, "link_requires_approval", "link_enabled", "link_token"):
        op.drop_column("conversations", column)
