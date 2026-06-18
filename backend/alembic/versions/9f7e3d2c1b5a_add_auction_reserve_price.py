"""add_auction_reserve_price

Revision ID: 9f7e3d2c1b5a
Revises: 28d43cb8f7f2
Create Date: 2026-06-18 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9f7e3d2c1b5a'
down_revision: Union[str, None] = '28d43cb8f7f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('auctions', sa.Column('reserve_price_centavos', sa.BigInteger(), nullable=True))
    op.execute("UPDATE auctions SET reserve_price_centavos = starting_bid_centavos WHERE reserve_price_centavos IS NULL")
    op.alter_column('auctions', 'reserve_price_centavos', nullable=False)


def downgrade() -> None:
    op.drop_column('auctions', 'reserve_price_centavos')
