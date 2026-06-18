"""add raffle draft/video/auto-close fields

Revision ID: 3b5f9c2e7d1a
Revises: 2a4f8c1d9e3b
Create Date: 2026-06-17 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '3b5f9c2e7d1a'
down_revision = '2a4f8c1d9e3b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to raffles table (safe for re-run)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_name='raffles' AND column_name='video_url') THEN
                ALTER TABLE raffles ADD COLUMN video_url TEXT;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_name='raffles' AND column_name='drawn_at') THEN
                ALTER TABLE raffles ADD COLUMN drawn_at TIMESTAMP WITH TIME ZONE;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_name='raffles' AND column_name='is_auto_closed') THEN
                ALTER TABLE raffles ADD COLUMN is_auto_closed BOOLEAN NOT NULL DEFAULT FALSE;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_name='raffles' AND column_name='activated_at') THEN
                ALTER TABLE raffles ADD COLUMN activated_at TIMESTAMP WITH TIME ZONE;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE raffles
            DROP COLUMN IF EXISTS video_url,
            DROP COLUMN IF EXISTS drawn_at,
            DROP COLUMN IF EXISTS is_auto_closed,
            DROP COLUMN IF EXISTS activated_at;
    """)
