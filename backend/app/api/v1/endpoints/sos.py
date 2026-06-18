"""
SOS endpoints — alerts, missing persons, lost & found, campaigns.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.sos import AlertCategory, AlertStatus, Campaign, LostFound, LostFoundType, MissingPerson, MissingPersonStatus, SOSAlert
from app.models.user import User
from app.services.cloudinary_service import upload_image

router = APIRouter(prefix="/sos", tags=["sos"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class AlertOut(BaseModel):
    id: str
    user_id: str
    category: str
    description: str | None
    status: str
    latitude: float | None
    longitude: float | None
    location_name: str | None
    created_at: datetime


class MissingPersonOut(BaseModel):
    id: str
    reporter_id: str
    name: str
    age: int | None
    person_type: str
    description: str
    photo_url: str | None
    last_seen_location: str | None
    last_seen_at: datetime | None
    status: str
    is_urgent: bool
    created_at: datetime


class LostFoundOut(BaseModel):
    id: str
    reporter_id: str
    item_type: str
    title: str
    description: str
    photo_url: str | None
    location: str | None
    contact_info: str | None
    is_resolved: bool
    created_at: datetime


class CampaignOut(BaseModel):
    id: str
    creator_id: str
    title: str
    description: str
    image_url: str | None
    goal_centavos: int
    current_centavos: int
    is_active: bool
    created_at: datetime
    ends_at: datetime | None
    pct: float


# ── SOS Alerts ────────────────────────────────────────────────────────────────

@router.post("/alerts", response_model=AlertOut)
async def create_alert(
    category: str = Form(...),
    description: str | None = Form(None),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    location_name: str | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    alert = SOSAlert(
        user_id=current_user.id,
        category=category,
        description=description,
        latitude=latitude,
        longitude=longitude,
        location_name=location_name,
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return _alert_out(alert)


@router.get("/alerts", response_model=list[AlertOut])
async def list_alerts(
    status: str = Query("active"),
    user_id: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    q = select(SOSAlert).order_by(SOSAlert.created_at.desc()).limit(limit)
    if status != "all":
        q = q.where(SOSAlert.status == status)
    if user_id:
        q = q.where(SOSAlert.user_id == uuid.UUID(user_id))
    result = await db.execute(q)
    return [_alert_out(a) for a in result.scalars().all()]


@router.patch("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SOSAlert).where(SOSAlert.id == uuid.UUID(alert_id)))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alerta não encontrado.")
    if str(alert.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Sem permissão.")
    alert.status = AlertStatus.RESOLVED
    alert.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Alerta resolvido."}


# ── Missing Persons ───────────────────────────────────────────────────────────

@router.post("/missing", response_model=MissingPersonOut)
async def report_missing(
    name: str = Form(...),
    age: int | None = Form(None),
    person_type: str = Form("pessoa"),
    description: str = Form(...),
    last_seen_location: str | None = Form(None),
    last_seen_at: datetime | None = Form(None),
    is_urgent: bool = Form(False),
    photo: UploadFile | None = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    photo_url = None
    if photo and photo.filename:
        photo_url = await upload_image(photo, folder="kalie/missing")

    person = MissingPerson(
        reporter_id=current_user.id,
        name=name, age=age, person_type=person_type,
        description=description, photo_url=photo_url,
        last_seen_location=last_seen_location,
        last_seen_at=last_seen_at, is_urgent=is_urgent,
    )
    db.add(person)
    await db.commit()
    await db.refresh(person)
    return _missing_out(person)


@router.get("/missing", response_model=list[MissingPersonOut])
async def list_missing(
    status: str = Query("active"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    q = select(MissingPerson).order_by(MissingPerson.created_at.desc()).limit(limit)
    if status != "all":
        q = q.where(MissingPerson.status == status)
    result = await db.execute(q)
    return [_missing_out(p) for p in result.scalars().all()]


@router.patch("/missing/{person_id}/found")
async def mark_found(
    person_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MissingPerson).where(MissingPerson.id == uuid.UUID(person_id)))
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Registo não encontrado.")
    person.status = MissingPersonStatus.FOUND
    await db.commit()
    return {"message": "Marcado como encontrado."}


# ── Lost & Found ──────────────────────────────────────────────────────────────

@router.post("/lost-found", response_model=LostFoundOut)
async def create_lost_found(
    item_type: str = Form(...),
    title: str = Form(...),
    description: str = Form(...),
    location: str | None = Form(None),
    contact_info: str | None = Form(None),
    photo: UploadFile | None = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    photo_url = None
    if photo and photo.filename:
        photo_url = await upload_image(photo, folder="kalie/lost-found")

    item = LostFound(
        reporter_id=current_user.id,
        item_type=item_type, title=title, description=description,
        photo_url=photo_url, location=location, contact_info=contact_info,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return _lostfound_out(item)


@router.get("/lost-found", response_model=list[LostFoundOut])
async def list_lost_found(
    item_type: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    q = select(LostFound).where(LostFound.is_resolved == False).order_by(LostFound.created_at.desc()).limit(limit)
    if item_type:
        q = q.where(LostFound.item_type == item_type)
    result = await db.execute(q)
    return [_lostfound_out(i) for i in result.scalars().all()]


# ── Campaigns ─────────────────────────────────────────────────────────────────

@router.post("/campaigns", response_model=CampaignOut)
async def create_campaign(
    title: str = Form(...),
    description: str = Form(...),
    goal_centavos: int = Form(..., gt=0),
    ends_at: datetime | None = Form(None),
    image: UploadFile | None = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    image_url = None
    if image and image.filename:
        image_url = await upload_image(image, folder="kalie/campaigns")

    campaign = Campaign(
        creator_id=current_user.id,
        title=title, description=description,
        image_url=image_url, goal_centavos=goal_centavos, ends_at=ends_at,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return _campaign_out(campaign)


@router.get("/campaigns", response_model=list[CampaignOut])
async def list_campaigns(
    creator_id: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    q = select(Campaign).where(Campaign.is_active == True).order_by(Campaign.created_at.desc()).limit(limit)
    if creator_id:
        q = q.where(Campaign.creator_id == uuid.UUID(creator_id))
    result = await db.execute(q)
    return [_campaign_out(c) for c in result.scalars().all()]


# ── Serializers ───────────────────────────────────────────────────────────────

def _alert_out(a: SOSAlert) -> AlertOut:
    return AlertOut(id=str(a.id), user_id=str(a.user_id), category=a.category,
                    description=a.description, status=a.status, latitude=a.latitude,
                    longitude=a.longitude, location_name=a.location_name, created_at=a.created_at)


def _missing_out(p: MissingPerson) -> MissingPersonOut:
    return MissingPersonOut(id=str(p.id), reporter_id=str(p.reporter_id), name=p.name,
                            age=p.age, person_type=p.person_type, description=p.description,
                            photo_url=p.photo_url, last_seen_location=p.last_seen_location,
                            last_seen_at=p.last_seen_at, status=p.status, is_urgent=p.is_urgent,
                            created_at=p.created_at)


def _lostfound_out(i: LostFound) -> LostFoundOut:
    return LostFoundOut(id=str(i.id), reporter_id=str(i.reporter_id), item_type=i.item_type,
                        title=i.title, description=i.description, photo_url=i.photo_url,
                        location=i.location, contact_info=i.contact_info,
                        is_resolved=i.is_resolved, created_at=i.created_at)


def _campaign_out(c: Campaign) -> CampaignOut:
    pct = round((c.current_centavos / c.goal_centavos) * 100, 1) if c.goal_centavos > 0 else 0
    return CampaignOut(id=str(c.id), creator_id=str(c.creator_id), title=c.title,
                       description=c.description, image_url=c.image_url,
                       goal_centavos=c.goal_centavos, current_centavos=c.current_centavos,
                       is_active=c.is_active, created_at=c.created_at, ends_at=c.ends_at, pct=pct)
