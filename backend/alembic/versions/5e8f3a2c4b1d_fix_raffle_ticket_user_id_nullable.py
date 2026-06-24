"""fix raffle_ticket user_id nullable

Revision ID: 5e8f3a2c4b1d
Revises: 4d7e9f2c1a3b
Create Date: 2026-06-17 18:30:00.000000
"""
from alembic import op

revision = '5e8f3a2c4b1d'
down_revision = '4d7e9f2c1a3b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='raffle_tickets' AND column_name='user_id'
                       AND is_nullable = 'NO') THEN
                ALTER TABLE raffle_tickets ALTER COLUMN user_id DROP NOT NULL;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE raffle_tickets ALTER COLUMN user_id SET NOT NULL;")
