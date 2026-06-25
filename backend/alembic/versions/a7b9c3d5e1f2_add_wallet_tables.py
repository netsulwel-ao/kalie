"""add_wallet_tables

Revision ID: a7b9c3d5e1f2
Revises: 04276d30f514
Create Date: 2026-06-24 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a7b9c3d5e1f2'
down_revision: Union[str, None] = '04276d30f514'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'wallets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False),
        sa.Column('balance_centavos', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('locked_centavos', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_wallets_user_id', 'wallets', ['user_id'])

    op.create_table(
        'transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('wallet_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('wallets.id', ondelete='CASCADE'), nullable=False),
        sa.Column('idempotency_key', sa.String(64), nullable=False),
        sa.Column('type', sa.String(30), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('amount_centavos', sa.BigInteger(), nullable=False),
        sa.Column('balance_after_centavos', sa.BigInteger(), nullable=False),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('extra_data', sa.Text(), nullable=True),
        sa.Column('hmac_signature', sa.String(64), nullable=True),
        sa.Column('external_ref', sa.String(128), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_transactions_wallet_id', 'transactions', ['wallet_id'])
    op.create_index('ix_transactions_created_at', 'transactions', ['created_at'])
    op.create_index('ix_transactions_idempotency_key', 'transactions', ['idempotency_key'], unique=True)


def downgrade() -> None:
    op.drop_table('transactions')
    op.drop_table('wallets')
