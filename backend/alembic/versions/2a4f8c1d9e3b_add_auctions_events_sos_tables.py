"""add auctions events sos tables

Revision ID: 2a4f8c1d9e3b
Revises: 1de5ecaa9e1f
Create Date: 2026-05-04 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '2a4f8c1d9e3b'
down_revision = '1de5ecaa9e1f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # auctions
    op.execute("""
        CREATE TABLE IF NOT EXISTS auctions (
            id UUID NOT NULL,
            creator_id UUID NOT NULL,
            title VARCHAR(200) NOT NULL,
            description TEXT NOT NULL,
            image_url TEXT,
            starting_bid_centavos BIGINT NOT NULL,
            current_bid_centavos BIGINT NOT NULL,
            min_increment_centavos BIGINT NOT NULL,
            status VARCHAR(20) NOT NULL,
            winner_id UUID,
            ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE,
            PRIMARY KEY (id),
            FOREIGN KEY(creator_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY(winner_id) REFERENCES users (id) ON DELETE SET NULL
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_auctions_creator_id ON auctions (creator_id)")

    # bids
    op.execute("""
        CREATE TABLE IF NOT EXISTS bids (
            id UUID NOT NULL,
            auction_id UUID NOT NULL,
            user_id UUID NOT NULL,
            amount_centavos BIGINT NOT NULL,
            is_winning BOOLEAN NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE,
            PRIMARY KEY (id),
            FOREIGN KEY(auction_id) REFERENCES auctions (id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_bids_auction_id ON bids (auction_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_bids_user_id ON bids (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_bids_created_at ON bids (created_at)")

    # events
    op.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id UUID NOT NULL,
            creator_id UUID NOT NULL,
            title VARCHAR(200) NOT NULL,
            description TEXT NOT NULL,
            image_url TEXT,
            category VARCHAR(20) NOT NULL,
            status VARCHAR(20) NOT NULL,
            location_name VARCHAR(200),
            latitude FLOAT,
            longitude FLOAT,
            max_attendees INTEGER,
            attendees_count INTEGER NOT NULL,
            starts_at TIMESTAMP WITH TIME ZONE,
            ends_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE,
            PRIMARY KEY (id),
            FOREIGN KEY(creator_id) REFERENCES users (id) ON DELETE CASCADE
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_events_creator_id ON events (creator_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_events_created_at ON events (created_at)")

    # sos_alerts
    op.execute("""
        CREATE TABLE IF NOT EXISTS sos_alerts (
            id UUID NOT NULL,
            user_id UUID NOT NULL,
            category VARCHAR(30) NOT NULL,
            description TEXT,
            status VARCHAR(20) NOT NULL,
            latitude FLOAT,
            longitude FLOAT,
            location_name VARCHAR(200),
            created_at TIMESTAMP WITH TIME ZONE,
            resolved_at TIMESTAMP WITH TIME ZONE,
            PRIMARY KEY (id),
            FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_sos_alerts_user_id ON sos_alerts (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sos_alerts_created_at ON sos_alerts (created_at)")

    # missing_persons
    op.execute("""
        CREATE TABLE IF NOT EXISTS missing_persons (
            id UUID NOT NULL,
            reporter_id UUID NOT NULL,
            name VARCHAR(200) NOT NULL,
            age INTEGER,
            person_type VARCHAR(20) NOT NULL,
            description TEXT NOT NULL,
            photo_url TEXT,
            last_seen_location VARCHAR(300),
            last_seen_at TIMESTAMP WITH TIME ZONE,
            status VARCHAR(20) NOT NULL,
            is_urgent BOOLEAN NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE,
            PRIMARY KEY (id),
            FOREIGN KEY(reporter_id) REFERENCES users (id) ON DELETE CASCADE
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_missing_persons_reporter_id ON missing_persons (reporter_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_missing_persons_created_at ON missing_persons (created_at)")

    # lost_found
    op.execute("""
        CREATE TABLE IF NOT EXISTS lost_found (
            id UUID NOT NULL,
            reporter_id UUID NOT NULL,
            item_type VARCHAR(10) NOT NULL,
            title VARCHAR(200) NOT NULL,
            description TEXT NOT NULL,
            photo_url TEXT,
            location VARCHAR(300),
            contact_info VARCHAR(200),
            is_resolved BOOLEAN NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE,
            PRIMARY KEY (id),
            FOREIGN KEY(reporter_id) REFERENCES users (id) ON DELETE CASCADE
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_lost_found_reporter_id ON lost_found (reporter_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_lost_found_created_at ON lost_found (created_at)")

    # campaigns
    op.execute("""
        CREATE TABLE IF NOT EXISTS campaigns (
            id UUID NOT NULL,
            creator_id UUID NOT NULL,
            title VARCHAR(200) NOT NULL,
            description TEXT NOT NULL,
            image_url TEXT,
            goal_centavos BIGINT NOT NULL,
            current_centavos BIGINT NOT NULL,
            is_active BOOLEAN NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE,
            ends_at TIMESTAMP WITH TIME ZONE,
            PRIMARY KEY (id),
            FOREIGN KEY(creator_id) REFERENCES users (id) ON DELETE CASCADE
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_campaigns_creator_id ON campaigns (creator_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_campaigns_created_at ON campaigns (created_at)")


def downgrade() -> None:
    op.drop_table('campaigns')
    op.drop_table('lost_found')
    op.drop_table('missing_persons')
    op.drop_table('sos_alerts')
    op.drop_table('events')
    op.drop_table('bids')
    op.drop_table('auctions')
