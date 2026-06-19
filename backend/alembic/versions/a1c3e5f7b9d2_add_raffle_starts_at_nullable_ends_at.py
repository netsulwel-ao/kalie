"""add_raffle_starts_at_nullable_ends_at

Revision ID: a1c3e5f7b9d2
Revises: 9f7e3d2c1b5a
Create Date: 2026-06-19 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c3e5f7b9d2'
down_revision: Union[str, None] = '9f7e3d2c1b5a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('raffles', sa.Column('starts_at', sa.DateTime(timezone=True), nullable=True))
    op.alter_column('raffles', 'ends_at', existing_type=sa.DateTime(timezone=True), nullable=True)


def downgrade() -> None:
    op.alter_column('raffles', 'ends_at', existing_type=sa.DateTime(timezone=True), nullable=False)
    op.drop_column('raffles', 'starts_at')
