"""
Bisno Rápido endpoints — produtos e serviços rápidos com geolocalização.
"""
import math
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, get_db
from app.models.bisno import (
    Bisno, BisnoType, BisnoCategory, ProductCondition,
    PriceType, ServiceModality, ContactMethod, BisnoStatus,
)
from app.models.user import User
from app.services.cloudinary_service import upload_images

router = APIRouter(prefix="/bisno", tags=["bisno"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class BisnoOut(BaseModel):
    id: str
    creator_id: str
    type: str
    title: str
    description: str
    category: str
    contact_method: str
    contact_value: str | None
    location_name: str | None
    latitude: float | None
    longitude: float | None
    images: list[str] | None
    price_centavos: int | None
    negotiable: bool
    condition: str | None
    price_type: str | None
    service_modality: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    distance_km: float | None = None
    creator_name: str | None = None
    creator_avatar: str | None = None


class BisnoUpdate(BaseModel):
    status: str | None = None
    title: str | None = None
    description: str | None = None
    category: str | None = None
    price_centavos: int | None = None
    negotiable: bool | None = None
    condition: str | None = None
    price_type: str | None = None
    service_modality: str | None = None
    contact_method: str | None = None
    contact_value: str | None = None
    location_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _out(b: Bisno, user_lat: float | None = None, user_lon: float | None = None) -> BisnoOut:
    dist = None
    if user_lat and user_lon and b.latitude and b.longitude:
        dist = round(_haversine(user_lat, user_lon, b.latitude, b.longitude), 2)
    return BisnoOut(
        id=str(b.id), creator_id=str(b.creator_id),
        type=b.type.value, title=b.title, description=b.description,
        category=b.category.value, contact_method=b.contact_method.value,
        contact_value=b.contact_value,
        location_name=b.location_name, latitude=b.latitude, longitude=b.longitude,
        images=b.images,
        price_centavos=b.price_centavos, negotiable=b.negotiable,
        condition=b.condition.value if b.condition else None,
        price_type=b.price_type.value if b.price_type else None,
        service_modality=b.service_modality.value if b.service_modality else None,
        status=b.status.value,
        created_at=b.created_at, updated_at=b.updated_at,
        distance_km=dist,
        creator_name=b.creator.full_name if b.creator else None,
        creator_avatar=b.creator.avatar_url if b.creator else None,
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[BisnoOut])
async def list_bisnos(
    type: str | None = Query(None, description="product | service"),
    category: str | None = Query(None),
    status: str = Query("active"),
    price_type: str | None = Query(None, description="hourly | fixed | negotiable"),
    q: str | None = Query(None, description="pesquisa por título"),
    lat: float | None = Query(None),
    lon: float | None = Query(None),
    radius_km: float = Query(50.0),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    qb = select(Bisno).options(
        selectinload(Bisno.creator),
    ).order_by(Bisno.created_at.desc()).limit(limit).offset(offset)

    if status != "all":
        qb = qb.where(Bisno.status == status)
    if type:
        qb = qb.where(Bisno.type == type)
    if category:
        qb = qb.where(Bisno.category == category)
    if price_type:
        qb = qb.where(Bisno.price_type == price_type)
    if q:
        qb = qb.where(Bisno.title.ilike(f"%{q}%"))

    result = await db.execute(qb)
    bisnos = result.scalars().all()

    out = []
    for b in bisnos:
        if lat and lon and b.latitude and b.longitude:
            dist = _haversine(lat, lon, b.latitude, b.longitude)
            if dist > radius_km:
                continue
        out.append(_out(b, lat, lon))
    return out


@router.post("", response_model=BisnoOut, status_code=201)
async def create_bisno(
    type: str = Form(...),
    title: str = Form(...),
    description: str = Form(...),
    category: str = Form(...),
    contact_method: str = Form("chat"),
    contact_value: str | None = Form(None),
    location_name: str | None = Form(None),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    price_centavos: int | None = Form(None),
    negotiable: bool = Form(False),
    condition: str | None = Form(None),
    price_type: str | None = Form(None),
    service_modality: str | None = Form(None),
    images: list[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    image_urls: list[str] | None = None
    if images:
        valid = [f for f in images if f.filename]
        if valid:
            image_urls = await upload_images(valid, folder="kalie/bisnos")

    bisno = Bisno(
        creator_id=current_user.id,
        type=BisnoType(type),
        title=title, description=description,
        category=BisnoCategory(category),
        contact_method=ContactMethod(contact_method),
        contact_value=contact_value,
        location_name=location_name,
        latitude=latitude, longitude=longitude,
        images=image_urls,
        price_centavos=price_centavos, negotiable=negotiable,
        condition=ProductCondition(condition) if condition else None,
        price_type=PriceType(price_type) if price_type else None,
        service_modality=ServiceModality(service_modality) if service_modality else None,
    )
    db.add(bisno)
    await db.commit()
    # Re-fetch with creator loaded for _out()
    result = await db.execute(select(Bisno).options(selectinload(Bisno.creator)).where(Bisno.id == bisno.id))
    bisno = result.scalar_one()
    return _out(bisno)


@router.get("/{bisno_id}", response_model=BisnoOut)
async def get_bisno(bisno_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Bisno).options(selectinload(Bisno.creator)).where(Bisno.id == uuid.UUID(bisno_id)))
    bisno = result.scalar_one_or_none()
    if not bisno:
        raise HTTPException(status_code=404, detail="Bisno não encontrado.")
    return _out(bisno)


@router.patch("/{bisno_id}", response_model=BisnoOut)
async def update_bisno(
    bisno_id: str,
    body: BisnoUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Bisno).options(selectinload(Bisno.creator)).where(Bisno.id == uuid.UUID(bisno_id)))
    bisno = result.scalar_one_or_none()
    if not bisno:
        raise HTTPException(status_code=404, detail="Bisno não encontrado.")
    if str(bisno.creator_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Sem permissão.")

    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        if value is None:
            setattr(bisno, field, None)
            continue
        if field == "status":
            try:
                value = BisnoStatus(value)
            except ValueError:
                raise HTTPException(status_code=400, detail="Status inválido.")
        elif field == "category":
            try:
                value = BisnoCategory(value)
            except ValueError:
                raise HTTPException(status_code=400, detail="Categoria inválida.")
        elif field == "condition":
            try:
                value = ProductCondition(value)
            except ValueError:
                raise HTTPException(status_code=400, detail="Condição inválida.")
        elif field == "price_type":
            try:
                value = PriceType(value)
            except ValueError:
                raise HTTPException(status_code=400, detail="Tipo de preço inválido.")
        elif field == "service_modality":
            try:
                value = ServiceModality(value)
            except ValueError:
                raise HTTPException(status_code=400, detail="Modalidade inválida.")
        elif field == "contact_method":
            try:
                value = ContactMethod(value)
            except ValueError:
                raise HTTPException(status_code=400, detail="Método de contacto inválido.")
        setattr(bisno, field, value)

    await db.commit()
    await db.refresh(bisno)
    return _out(bisno)


@router.delete("/{bisno_id}")
async def delete_bisno(
    bisno_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Bisno).where(Bisno.id == uuid.UUID(bisno_id)))
    bisno = result.scalar_one_or_none()
    if not bisno:
        raise HTTPException(status_code=404, detail="Bisno não encontrado.")
    if str(bisno.creator_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Sem permissão.")
    await db.delete(bisno)
    await db.commit()
    return {"message": "Bisno eliminado."}
