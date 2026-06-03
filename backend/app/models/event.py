"""
Event model — for the Mapa/Explorar module.
"""
import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class EventCategory(str, Enum):
    EVENTO   = "evento"
    BISNO    = "bisno"
    SOS      = "sos"
    JOGADOR  = "jogador"
    TORNEIO  = "torneio"
    OUTRO    = "outro"


class EventStatus(str, Enum):
    ACTIVE    = "active"
    CANCELLED = "cancelled"
    FINISHED  = "finished"


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    creator_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    category: Mapped[EventCategory] = mapped_column(String(20), default=EventCategory.EVENTO, nullable=False)
    status: Mapped[EventStatus] = mapped_column(String(20), default=EventStatus.ACTIVE, nullable=False)

    # Location
    location_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Attendance
    max_attendees: Mapped[int | None] = mapped_column(Integer, nullable=True)
    attendees_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    creator: Mapped["User"] = relationship("User", foreign_keys=[creator_id])  # type: ignore
