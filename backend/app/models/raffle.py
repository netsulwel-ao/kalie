"""
Raffle (Rifa) model — Provably Fair using HMAC-SHA256.
"""
import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class RaffleStatus(str, Enum):
    ACTIVE    = "active"
    DRAWING   = "drawing"
    FINISHED  = "finished"
    CANCELLED = "cancelled"


class Raffle(Base):
    __tablename__ = "raffles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    creator_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Pricing
    ticket_price_centavos: Mapped[int] = mapped_column(BigInteger, nullable=False)
    max_tickets: Mapped[int] = mapped_column(Integer, nullable=False)
    tickets_sold: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    status: Mapped[RaffleStatus] = mapped_column(String(20), default=RaffleStatus.ACTIVE, nullable=False)

    # Provably Fair
    server_seed: Mapped[str] = mapped_column(String(64), nullable=False)       # secret until draw
    server_seed_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # shown before draw
    client_seed: Mapped[str | None] = mapped_column(String(64), nullable=True) # set at draw time
    nonce: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Result
    winner_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    winning_ticket: Mapped[int | None] = mapped_column(Integer, nullable=True)

    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    creator: Mapped["User"] = relationship("User", foreign_keys=[creator_id])  # type: ignore
    winner: Mapped["User | None"] = relationship("User", foreign_keys=[winner_id])  # type: ignore
    tickets: Mapped[list["RaffleTicket"]] = relationship("RaffleTicket", back_populates="raffle", cascade="all, delete-orphan")


class RaffleTicket(Base):
    __tablename__ = "raffle_tickets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    raffle_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("raffles.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    ticket_number: Mapped[int] = mapped_column(Integer, nullable=False)
    purchased_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    raffle: Mapped["Raffle"] = relationship("Raffle", back_populates="tickets")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])  # type: ignore
