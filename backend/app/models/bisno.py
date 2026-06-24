import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, Enum, Float, ForeignKey, Integer, String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class BisnoType(str, enum.Enum):
    PRODUCT = "product"
    SERVICE = "service"


class BisnoCategory(str, enum.Enum):
    TECNOLOGIA  = "tecnologia"
    ENTREGAS    = "entregas"
    TRANSPORTE  = "transporte"
    SERVICOS    = "servicos"
    MODA        = "moda"
    CASA        = "casa"
    EDUCACAO    = "educacao"
    SAUDE       = "saude"
    OUTRO       = "outro"


class ProductCondition(str, enum.Enum):
    NEW = "new"
    USED = "used"


class PriceType(str, enum.Enum):
    HOURLY      = "hourly"
    FIXED       = "fixed"
    NEGOTIABLE  = "negotiable"


class ServiceModality(str, enum.Enum):
    HOME      = "home"
    IN_PERSON = "in_person"


class ContactMethod(str, enum.Enum):
    CHAT      = "chat"
    WHATSAPP  = "whatsapp"
    CALL      = "call"


class BisnoStatus(str, enum.Enum):
    ACTIVE    = "active"
    SOLD      = "sold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Bisno(Base):
    __tablename__ = "bisnos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # ── Tipo ────────────────────────────────────────────────────────
    type: Mapped[BisnoType] = mapped_column(
        Enum(BisnoType), nullable=False,
    )

    # ── Campos comuns ───────────────────────────────────────────────
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[BisnoCategory] = mapped_column(
        Enum(BisnoCategory), nullable=False,
    )
    contact_method: Mapped[ContactMethod] = mapped_column(
        Enum(ContactMethod), default=ContactMethod.CHAT, nullable=False,
    )
    contact_value: Mapped[str | None] = mapped_column(
        String(100), nullable=True,  # phone number for whatsapp/call
    )

    # ── Localização ─────────────────────────────────────────────────
    location_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    # ── Imagens ─────────────────────────────────────────────────────
    images: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    # ── Produto ─────────────────────────────────────────────────────
    price_centavos: Mapped[int | None] = mapped_column(Integer, nullable=True)
    negotiable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    condition: Mapped[ProductCondition | None] = mapped_column(
        Enum(ProductCondition), nullable=True,
    )

    # ── Serviço ─────────────────────────────────────────────────────
    price_type: Mapped[PriceType | None] = mapped_column(
        Enum(PriceType), nullable=True,
    )
    service_modality: Mapped[ServiceModality | None] = mapped_column(
        Enum(ServiceModality), nullable=True,
    )

    # ── Status & tempo ──────────────────────────────────────────────
    status: Mapped[BisnoStatus] = mapped_column(
        Enum(BisnoStatus), default=BisnoStatus.ACTIVE, nullable=False, index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ── Relacionamentos ─────────────────────────────────────────────
    creator: Mapped["User"] = relationship("User", foreign_keys=[creator_id])
