"""
Wallet & Transaction models.
Double-entry bookkeeping: every debit has a corresponding credit.
All amounts in Kwanza (AOA) stored as integers (centavos) to avoid float precision issues.
"""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TransactionType(str, Enum):
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    TRANSFER_IN = "transfer_in"
    TRANSFER_OUT = "transfer_out"
    GAME_WIN = "game_win"
    GAME_LOSS = "game_loss"
    RAFFLE_ENTRY = "raffle_entry"
    RAFFLE_WIN = "raffle_win"
    AUCTION_BID = "auction_bid"
    AUCTION_REFUND = "auction_refund"
    FEE = "fee"


class TransactionStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REVERSED = "reversed"


class Wallet(Base):
    __tablename__ = "wallets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    # Balance in Kwanza (AOA) — stored as integer centavos to avoid float issues
    # 1 AOA = 100 centavos
    balance_centavos: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)

    # Locked balance (in active bids, game stakes, etc.)
    locked_centavos: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="wallet")
    transactions: Mapped[list["Transaction"]] = relationship(
        "Transaction", back_populates="wallet", order_by="Transaction.created_at.desc()"
    )

    @property
    def balance_aoa(self) -> Decimal:
        """Balance in AOA (human-readable)."""
        return Decimal(self.balance_centavos) / 100

    @property
    def available_centavos(self) -> int:
        """Available (unlocked) balance."""
        return self.balance_centavos - self.locked_centavos

    def __repr__(self) -> str:
        return f"<Wallet user={self.user_id} balance={self.balance_aoa} AOA>"


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    wallet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Idempotency key — prevents double processing
    idempotency_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)

    type: Mapped[TransactionType] = mapped_column(String(30), nullable=False)
    status: Mapped[TransactionStatus] = mapped_column(
        String(20), default=TransactionStatus.PENDING, nullable=False
    )

    # Amount in centavos (always positive; direction determined by type)
    amount_centavos: Mapped[int] = mapped_column(BigInteger, nullable=False)

    # Balance snapshot after this transaction
    balance_after_centavos: Mapped[int] = mapped_column(BigInteger, nullable=False)

    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    extra_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string — "metadata" é reservado pelo SQLAlchemy

    # HMAC signature for audit log integrity
    hmac_signature: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Reference to external payment (Sulin, etc.)
    external_ref: Mapped[str | None] = mapped_column(String(128), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    # Relationships
    wallet: Mapped["Wallet"] = relationship("Wallet", back_populates="transactions")

    def __repr__(self) -> str:
        return f"<Transaction {self.type} {self.amount_centavos} centavos>"
