"""add raffle ticket reservation, status, audit history

Revision ID: 4d7e9f2c1a3b
Revises: 3b5f9c2e7d1a
Create Date: 2026-06-17 14:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '4d7e9f2c1a3b'
down_revision = '3b5f9c2e7d1a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Raffles: add min_tickets_for_draw ──────────────────────────
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_name='raffles' AND column_name='min_tickets_for_draw') THEN
                ALTER TABLE raffles ADD COLUMN min_tickets_for_draw INTEGER NOT NULL DEFAULT 0;
            END IF;
        END $$;
    """)

    # ── Raffle Tickets: add status, reservation, make user_id nullable ──
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_name='raffle_tickets' AND column_name='status') THEN
                ALTER TABLE raffle_tickets ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'sold';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_name='raffle_tickets' AND column_name='reserved_at') THEN
                ALTER TABLE raffle_tickets ADD COLUMN reserved_at TIMESTAMP WITH TIME ZONE;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_name='raffle_tickets' AND column_name='reserved_until') THEN
                ALTER TABLE raffle_tickets ADD COLUMN reserved_until TIMESTAMP WITH TIME ZONE;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_name='raffle_tickets' AND column_name='reserved_by_id') THEN
                ALTER TABLE raffle_tickets ADD COLUMN reserved_by_id UUID;
                ALTER TABLE raffle_tickets ADD FOREIGN KEY (reserved_by_id) REFERENCES users(id) ON DELETE SET NULL;
            END IF;
            -- Make user_id nullable
            IF EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='raffle_tickets' AND column_name='user_id'
                       AND is_nullable = 'NO') THEN
                ALTER TABLE raffle_tickets ALTER COLUMN user_id DROP NOT NULL;
            END IF;
            -- Make purchased_at nullable
            IF EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='raffle_tickets' AND column_name='purchased_at'
                       AND is_nullable = 'NO') THEN
                ALTER TABLE raffle_tickets ALTER COLUMN purchased_at DROP NOT NULL;
            END IF;
        END $$;
    """)

    # ── Raffle Ticket History (audit trail) ─────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS raffle_ticket_history (
            id UUID NOT NULL,
            raffle_id UUID NOT NULL,
            ticket_id UUID,
            ticket_number INTEGER NOT NULL,
            user_id UUID,
            action VARCHAR(30) NOT NULL,
            from_status VARCHAR(20),
            to_status VARCHAR(20),
            metadata_json TEXT,
            created_at TIMESTAMP WITH TIME ZONE,
            PRIMARY KEY (id),
            FOREIGN KEY(raffle_id) REFERENCES raffles (id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_raffle_ticket_history_raffle_id ON raffle_ticket_history (raffle_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_raffle_ticket_history_created_at ON raffle_ticket_history (created_at)")


def downgrade() -> None:
    op.drop_table('raffle_ticket_history')
    op.execute("""
        ALTER TABLE raffle_tickets
            DROP COLUMN IF EXISTS status,
            DROP COLUMN IF EXISTS reserved_at,
            DROP COLUMN IF EXISTS reserved_until,
            DROP COLUMN IF EXISTS reserved_by_id;
    """)
    op.execute("ALTER TABLE raffles DROP COLUMN IF EXISTS min_tickets_for_draw;")
