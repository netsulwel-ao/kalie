"""
Events (Mapa/Explorar) endpoints.
"""
import math
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.event import Event, EventCategory, EventStatus
from app.models.user import User
from app.services.cloudinary_service import upload_image

router = APIRouter(prefix="/events", tags=["events"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class EventOut(BaseModel):
    id: str
    creator_id: str
    title: str
    description: str
    image_url: str | None
    category: str
    status: str
    location_name: str | None
    latitude: float | None
    longitude: float | None
    max_attendees: int | None
    attendees_count: int
    starts_at: datetime | None
    ends_at: datetime | None
    created_at: datetime
    distance_km: float | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance in km between two coordinates."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _event_out(e: Event, user_lat: float | None = None, user_lon: float | None = None) -> EventOut:
    dist = None
    if user_lat and user_lon and e.latitude and e.longitude:
        dist = round(_haversine(user_lat, user_lon, e.latitude, e.longitude), 2)
    return EventOut(
        id=str(e.id), creator_id=str(e.creator_id),
        title=e.title, description=e.description, image_url=e.image_url,
        category=e.category, status=e.status,
        location_name=e.location_name, latitude=e.latitude, longitude=e.longitude,
        max_attendees=e.max_attendees, attendees_count=e.attendees_count,
        starts_at=e.starts_at, ends_at=e.ends_at, created_at=e.created_at,
        distance_km=dist,
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[EventOut])
async def list_events(
    category: str | None = Query(None),
    status: str = Query("active"),
    lat: float | None = Query(None),
    lon: float | None = Query(None),
    radius_km: float = Query(50.0),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    q = select(Event).order_by(Event.created_at.desc()).limit(limit).offset(offset)
    if status != "all":
        q = q.where(Event.status == status)
    if category:
        q = q.where(Event.category == category)
    result = await db.execute(q)
    events = result.scalars().all()

    out = []
    for e in events:
        if lat and lon and e.latitude and e.longitude:
            dist = _haversine(lat, lon, e.latitude, e.longitude)
            if dist > radius_km:
                continue
        out.append(_event_out(e, lat, lon))
    return out


@router.post("", response_model=EventOut)
async def create_event(
    title: str = Form(...),
    description: str = Form(...),
    category: str = Form("evento"),
    location_name: str | None = Form(None),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    max_attendees: int | None = Form(None),
    starts_at: datetime | None = Form(None),
    ends_at: datetime | None = Form(None),
    image: UploadFile | None = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    image_url = None
    if image and image.filename:
        image_url = await upload_image(image, folder="kalie/events")

    event = Event(
        creator_id=current_user.id,
        title=title,
        description=description,
        image_url=image_url,
        category=category,
        location_name=location_name,
        latitude=latitude,
        longitude=longitude,
        max_attendees=max_attendees,
        starts_at=starts_at,
        ends_at=ends_at,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return _event_out(event)


@router.get("/{event_id}", response_model=EventOut)
async def get_event(event_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Event).where(Event.id == uuid.UUID(event_id)))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")
    return _event_out(event)


@router.post("/{event_id}/attend")
async def attend_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Event).where(Event.id == uuid.UUID(event_id)))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")
    if event.max_attendees and event.attendees_count >= event.max_attendees:
        raise HTTPException(status_code=400, detail="Evento lotado.")
    event.attendees_count += 1
    await db.commit()
    return {"message": "Presença confirmada.", "attendees_count": event.attendees_count}


@router.delete("/{event_id}")
async def delete_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Event).where(Event.id == uuid.UUID(event_id)))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")
    if str(event.creator_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Sem permissão.")
    event.status = EventStatus.CANCELLED
    await db.commit()
    return {"message": "Evento cancelado."}
