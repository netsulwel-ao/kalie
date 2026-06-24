"""
Auction (Leilão) model — Provably Fair bidding, escrow, anti-sniping, audit.
"""
import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AuctionStatus(str, Enum):
    ACTIVE    = "active"
    FINISHED  = "finished"
    CANCELLED = "cancelled"


class AuctionDeliveryStatus(str, Enum):
    PENDING    = "pending"
    CONFIRMED  = "confirmed"
    COMPLETED  = "completed"


class Auction(Base):
    __tablename__ = "auctions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    creator_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    starting_bid_centavos: Mapped[int] = mapped_column(BigInteger, nullable=False)
    reserve_price_centavos: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    current_bid_centavos: Mapped[int] = mapped_column(BigInteger, nullable=False)
    min_increment_centavos: Mapped[int] = mapped_column(BigInteger, default=100, nullable=False)
    pool_held_centavos: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)

    status: Mapped[AuctionStatus] = mapped_column(String(20), default=AuctionStatus.ACTIVE, nullable=False)

    winner_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at_extended: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    anti_sniping_window_seconds: Mapped[int] = mapped_column(Integer, default=120, nullable=False)
    extensions_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_extensions: Mapped[int] = mapped_column(Integer, default=5, nullable=False)

    delivery_code: Mapped[str | None] = mapped_column(String(10), nullable=True, index=True)
    delivery_status: Mapped[AuctionDeliveryStatus] = mapped_column(String(20), default=AuctionDeliveryStatus.PENDING, nullable=False)
    delivery_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    creator: Mapped["User"] = relationship("User", foreign_keys=[creator_id])  # type: ignore
    winner: Mapped["User | None"] = relationship("User", foreign_keys=[winner_id])  # type: ignore
    bids: Mapped[list["Bid"]] = relationship("Bid", back_populates="auction", cascade="all, delete-orphan", order_by="Bid.created_at.desc()")


class Bid(Base):
    __tablename__ = "bids"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auction_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auctions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    amount_centavos: Mapped[int] = mapped_column(BigInteger, nullable=False)
    is_winning: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    refunded: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    auction: Mapped["Auction"] = relationship("Auction", back_populates="bids")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])  # type: ignore


class AuctionAuditLog(Base):
    __tablename__ = "auction_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auction_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auctions.id", ondelete="CASCADE"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    details: Mapped[dict | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
