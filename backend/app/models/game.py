"""
Game models — challenges (matches) for Chess and Ludo.
Backend is the source of truth for all game state.
"""
import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class GameType(str, Enum):
    CHESS = "chess"
    LUDO  = "ludo"


class ChallengeStatus(str, Enum):
    WAITING    = "waiting"     # waiting for opponent
    IN_PROGRESS = "in_progress"
    FINISHED   = "finished"
    CANCELLED  = "cancelled"


class Challenge(Base):
    __tablename__ = "challenges"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    game_type: Mapped[GameType] = mapped_column(String(20), nullable=False)
    status: Mapped[ChallengeStatus] = mapped_column(String(20), default=ChallengeStatus.WAITING, nullable=False)

    # Players
    creator_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    opponent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Invite
    invite_code: Mapped[str] = mapped_column(String(12), unique=True, nullable=False, index=True)

    # Time control (seconds per player, e.g. 600 = 10 min, 300 = 5 min, 180 = 3 min)
    time_control: Mapped[int] = mapped_column(Integer, default=600, nullable=False)

    # Game state (JSON stored as text)
    game_state: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON

    # Chess specific
    current_turn: Mapped[str | None] = mapped_column(String(10), nullable=True)  # "white" | "black"
    creator_color: Mapped[str | None] = mapped_column(String(10), nullable=True)  # "white" | "black"

    # Result
    winner_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    finish_reason: Mapped[str | None] = mapped_column(String(50), nullable=True)  # "checkmate", "resign", "timeout", etc.

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    creator: Mapped["User"] = relationship("User", foreign_keys=[creator_id])  # type: ignore
    opponent: Mapped["User | None"] = relationship("User", foreign_keys=[opponent_id])  # type: ignore
    winner: Mapped["User | None"] = relationship("User", foreign_keys=[winner_id])  # type: ignore
