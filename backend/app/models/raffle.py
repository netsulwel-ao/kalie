"""
Raffle (Rifa) model — Provably Fair using HMAC-SHA256.
Suporta rascunho, ativação com pré-geração de bilhetes,
compra atómica, reserva temporária, histórico de auditoria,
escrow com confirmação de entrega e disputas.
"""
import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class RaffleStatus(str, Enum):
    DRAFT     = "draft"
    ACTIVE    = "active"
    DRAWING   = "drawing"
    FINISHED  = "finished"
    CANCELLED = "cancelled"


class RaffleTicketStatus(str, Enum):
    AVAILABLE = "available"
    RESERVED  = "reserved"
    SOLD      = "sold"


class DeliveryStatus(str, Enum):
    PENDING                  = "pending"
    CONFIRMED_BY_WINNER      = "confirmed_by_winner"
    CONFIRMED_BY_CREATOR     = "confirmed_by_creator"
    COMPLETED                = "completed"
    EXPIRED                  = "expired"
    DISPUTED                 = "disputed"


class Raffle(Base):
    __tablename__ = "raffles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    creator_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Pricing
    ticket_price_centavos: Mapped[int] = mapped_column(BigInteger, nullable=False)
    max_tickets: Mapped[int] = mapped_column(Integer, nullable=False)
    tickets_sold: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Minimum sales to allow draw (0 = no minimum)
    min_tickets_for_draw: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Escrow — total centavos held from ticket sales pending delivery
    pool_held_centavos: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)

    status: Mapped[RaffleStatus] = mapped_column(String(20), default=RaffleStatus.DRAFT, nullable=False)

    # Provably Fair
    server_seed: Mapped[str] = mapped_column(String(64), nullable=False)
    server_seed_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    client_seed: Mapped[str | None] = mapped_column(String(64), nullable=True)
    nonce: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Result
    winner_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    winning_ticket: Mapped[int | None] = mapped_column(Integer, nullable=True)
    drawn_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_auto_closed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    creator: Mapped["User"] = relationship("User", foreign_keys=[creator_id])
    winner: Mapped["User | None"] = relationship("User", foreign_keys=[winner_id])
    tickets: Mapped[list["RaffleTicket"]] = relationship("RaffleTicket", back_populates="raffle", cascade="all, delete-orphan")
    delivery_code: Mapped["DeliveryCode | None"] = relationship("DeliveryCode", back_populates="raffle", uselist=False, cascade="all, delete-orphan")

    def is_active(self) -> bool:
        return self.status == RaffleStatus.ACTIVE and datetime.now(timezone.utc) < self.ends_at and self.tickets_sold < self.max_tickets

    def pct_sold(self) -> float:
        return round((self.tickets_sold / self.max_tickets) * 100, 1) if self.max_tickets > 0 else 0


class RaffleTicket(Base):
    __tablename__ = "raffle_tickets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    raffle_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("raffles.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    ticket_number: Mapped[int] = mapped_column(Integer, nullable=False)

    status: Mapped[RaffleTicketStatus] = mapped_column(String(20), default=RaffleTicketStatus.AVAILABLE, nullable=False)

    reserved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reserved_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reserved_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    purchased_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    raffle: Mapped["Raffle"] = relationship("Raffle", back_populates="tickets")
    user: Mapped["User | None"] = relationship("User", foreign_keys=[user_id])
    reserved_by: Mapped["User | None"] = relationship("User", foreign_keys=[reserved_by_id])


class RaffleTicketHistory(Base):
    """Audit trail for ticket state changes."""
    __tablename__ = "raffle_ticket_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    raffle_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("raffles.id", ondelete="CASCADE"), nullable=False, index=True)
    ticket_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    ticket_number: Mapped[int] = mapped_column(Integer, nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    action: Mapped[str] = mapped_column(String(30), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    to_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    raffle: Mapped["Raffle"] = relationship("Raffle", foreign_keys=[raffle_id])
    user: Mapped["User | None"] = relationship("User", foreign_keys=[user_id])


class DeliveryCode(Base):
    """Unique delivery confirmation code generated after raffle draw.
    Tracks escrow release, dual confirmation, and dispute lifecycle."""
    __tablename__ = "delivery_codes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    raffle_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("raffles.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    winner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    creator_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    qr_data: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[DeliveryStatus] = mapped_column(String(30), default=DeliveryStatus.PENDING, nullable=False)

    escrow_amount_centavos: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    dual_confirmation: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    confirmed_by_winner_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    confirmed_by_creator_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    dispute_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    dispute_opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dispute_resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dispute_resolution: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    raffle: Mapped["Raffle"] = relationship("Raffle", back_populates="delivery_code")
    winner: Mapped["User"] = relationship("User", foreign_keys=[winner_id])
    creator: Mapped["User"] = relationship("User", foreign_keys=[creator_id])
    audit_logs: Mapped[list["DeliveryAuditLog"]] = relationship("DeliveryAuditLog", back_populates="delivery_code", cascade="all, delete-orphan")


class DeliveryAuditLog(Base):
    """Audit trail for every delivery/escrow event."""
    __tablename__ = "delivery_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    delivery_code_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("delivery_codes.id", ondelete="CASCADE"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    delivery_code: Mapped["DeliveryCode"] = relationship("DeliveryCode", back_populates="audit_logs")
    actor: Mapped["User | None"] = relationship("User")
