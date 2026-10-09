"""contact nickname family name and note

Signal's Nickname dialog takes a first name, a last name and a private
note. The existing nickname column holds the first name. Plain ADD COLUMN,
as in b7c1d2e3f4a5.

Revision ID: e5b9c3d7a2f1
Revises: d4a8e6b2c1f7
Create Date: 2026-10-09 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5b9c3d7a2f1"
down_revision: Union[str, None] = "d4a8e6b2c1f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("contacts", sa.Column("nickname_family", sa.String(length=64), nullable=True))
    op.add_column("contacts", sa.Column("note", sa.String(length=240), nullable=True))


def downgrade() -> None:
    op.drop_column("contacts", "note")
    op.drop_column("contacts", "nickname_family")
