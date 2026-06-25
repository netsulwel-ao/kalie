"""add_waitlist_table — stub (table already exists in DB)

Revision ID: 1950d3a0555f
Revises: bb265bd26855
Create Date: 2026-06-10 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '1950d3a0555f'
down_revision: Union[str, None] = '04276d30f514'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
