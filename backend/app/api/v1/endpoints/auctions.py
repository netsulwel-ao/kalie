"""
Auctions (Leilões) endpoints — full CRUD, bidding with anti-sniping, delivery.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, get_optional_current_user
from app.models.auction import Auction, AuctionStatus, Bid
from app.models.user import User
from app.services import auction_service
from app.services.cloudinary_service import upload_image

router = APIRouter(prefix="/auctions", tags=["auctions"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class AuctionOut(BaseModel):
    id: str
    creator_id: str
    title: str
    description: str
    image_url: str | None
    starting_bid_centavos: int
    reserve_price_centavos: int
    current_bid_centavos: int
    min_increment_centavos: int
    pool_held_centavos: int
    status: str
    winner_id: str | None
    starts_at: datetime
    ends_at: datetime
    ends_at_extended: datetime | None = None
    anti_sniping_window_seconds: int = 120
    extensions_count: int = 0
    max_extensions: int = 5
    has_delivery_code: bool = False
    delivery_code: str | None = None
    delivery_status: str = "pending"
    delivery_confirmed_at: datetime | None = None
    total_bids: int = 0
    total_participants: int = 0
    user_position: str | None = None
    user_bid_amount: int | None = None
    min_next_bid: int = 0
    created_at: datetime


class BidHistoryItem(BaseModel):
    amount_centavos: int
    bidder_label: str
    is_winning: bool
    is_active: bool
    created_at: datetime


class ParticipantOut(BaseModel):
    label: str
    name: str
    total_locked_centavos: int
    bid_count: int


class PlaceBidRequest(BaseModel):
    amount_centavos: int


class PlaceBidOut(BaseModel):
    id: str
    auction_id: str
    amount_centavos: int
    is_winning: bool
    created_at: datetime


class DeliveryLookupOut(BaseModel):
    id: str
    title: str
    image_url: str | None
    pool_held_centavos: int
    delivery_status: str
    winner_name: str


class DeliveryConfirmOut(BaseModel):
    message: str
    amount_centavos: int


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[AuctionOut])
async def list_auctions(
    status: str = Query("active"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    await auction_service.auto_finalize_expired(db)
    q = select(Auction).order_by(Auction.created_at.desc()).limit(limit).offset(offset)
    if status != "all":
        q = q.where(Auction.status == status)
    result = await db.execute(q)
    auctions = result.scalars().all()

    out = []
    for a in auctions:
        bids_result = await db.execute(
            select(func.count(Bid.id)).where(Bid.auction_id == a.id)
        )
        total = bids_result.scalar() or 0
        participant_count = await db.execute(
            select(func.count(func.distinct(Bid.user_id)))
            .where(Bid.auction_id == a.id, Bid.is_active == True)
        )
        participants = participant_count.scalar() or 0
        out.append(AuctionOut(
            id=str(a.id), creator_id=str(a.creator_id),
            title=a.title, description=a.description, image_url=a.image_url,
            starting_bid_centavos=a.starting_bid_centavos,
            reserve_price_centavos=a.reserve_price_centavos,
            current_bid_centavos=a.current_bid_centavos,
            min_increment_centavos=a.min_increment_centavos,
            pool_held_centavos=a.pool_held_centavos,
            status=a.status, winner_id=str(a.winner_id) if a.winner_id else None,
            starts_at=a.starts_at, ends_at=a.ends_at, ends_at_extended=a.ends_at_extended,
            anti_sniping_window_seconds=a.anti_sniping_window_seconds,
            extensions_count=a.extensions_count, max_extensions=a.max_extensions,
            has_delivery_code=a.delivery_code is not None, delivery_status=a.delivery_status,
            delivery_confirmed_at=a.delivery_confirmed_at,
            total_bids=total, total_participants=participants,
            min_next_bid=a.reserve_price_centavos if a.current_bid_centavos == 0 else a.current_bid_centavos + a.min_increment_centavos,
            created_at=a.created_at,
        ))
    return out


@router.post("", response_model=AuctionOut)
async def create_auction(
    title: str = Form(...),
    description: str = Form(...),
    starts_at: datetime = Form(...),
    ends_at: datetime = Form(...),
    starting_bid_centavos: int = Form(..., gt=0),
    reserve_price_centavos: int = Form(..., ge=0),
    min_increment_centavos: int = Form(100, gt=0),
    image: UploadFile | None = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    image_url = None
    if image and image.filename:
        image_url = await upload_image(image, folder="kalie/auctions")

    auction = Auction(
        creator_id=current_user.id, title=title, description=description,
        image_url=image_url,
        starting_bid_centavos=starting_bid_centavos,
        reserve_price_centavos=reserve_price_centavos,
        current_bid_centavos=0,
        min_increment_centavos=min_increment_centavos,
        status=AuctionStatus.ACTIVE, starts_at=starts_at, ends_at=ends_at,
    )
    db.add(auction)
    await db.commit()
    await db.refresh(auction)
    return AuctionOut(
        id=str(auction.id), creator_id=str(auction.creator_id),
        title=auction.title, description=auction.description,
        image_url=auction.image_url,
        starting_bid_centavos=auction.starting_bid_centavos,
        reserve_price_centavos=auction.reserve_price_centavos,
        current_bid_centavos=auction.current_bid_centavos,
        min_increment_centavos=auction.min_increment_centavos,
        pool_held_centavos=auction.pool_held_centavos,
        status=auction.status,
        winner_id=str(auction.winner_id) if auction.winner_id else None,
        starts_at=auction.starts_at, ends_at=auction.ends_at, ends_at_extended=auction.ends_at_extended,
        anti_sniping_window_seconds=auction.anti_sniping_window_seconds,
        extensions_count=auction.extensions_count,
        max_extensions=auction.max_extensions,
        has_delivery_code=auction.delivery_code is not None,
        delivery_status=auction.delivery_status,
        delivery_confirmed_at=auction.delivery_confirmed_at,
        total_bids=0, total_participants=0,
        min_next_bid=auction.reserve_price_centavos if auction.current_bid_centavos == 0 else auction.current_bid_centavos + auction.min_increment_centavos,
        created_at=auction.created_at,
    )


# ── My bids / My won auctions (must be before /{auction_id}) ────────────────────

class MyWinOut(BaseModel):
    id: str
    title: str
    image_url: str | None
    current_bid_centavos: int
    delivery_status: str
    winner_name: str | None = None


class DeliveryStatusOut(BaseModel):
    id: str
    title: str
    image_url: str | None
    current_bid_centavos: int
    delivery_code: str | None
    delivery_status: str
    status: str


@router.get("/my-bids", response_model=list[AuctionOut])
async def my_bids(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all auctions where the current user has placed bids."""
    await auction_service.auto_finalize_expired(db)
    subq = select(Bid.auction_id).where(Bid.user_id == current_user.id).distinct().subquery()
    q = select(Auction).where(Auction.id.in_(select(subq))).order_by(Auction.created_at.desc())
    result = await db.execute(q)
    auctions = result.scalars().all()
    out = []
    for a in auctions:
        bids_result = await db.execute(
            select(func.count(Bid.id)).where(Bid.auction_id == a.id)
        )
        total = bids_result.scalar() or 0
        participant_count = await db.execute(
            select(func.count(func.distinct(Bid.user_id)))
            .where(Bid.auction_id == a.id, Bid.is_active == True)
        )
        participants = participant_count.scalar() or 0
        up = None
        ub = None
        user_bid = await db.execute(
            select(Bid).where(Bid.auction_id == a.id, Bid.user_id == current_user.id,
                              Bid.is_active == True).order_by(Bid.created_at.desc()).limit(1)
        )
        ub_row = user_bid.scalar_one_or_none()
        if ub_row:
            up = "leading" if ub_row.is_winning else "outbidded"
            ub = ub_row.amount_centavos
        out.append(AuctionOut(
            id=str(a.id), creator_id=str(a.creator_id),
            title=a.title, description=a.description, image_url=a.image_url,
            starting_bid_centavos=a.starting_bid_centavos,
            reserve_price_centavos=a.reserve_price_centavos,
            current_bid_centavos=a.current_bid_centavos,
            min_increment_centavos=a.min_increment_centavos,
            pool_held_centavos=a.pool_held_centavos,
            status=a.status, winner_id=str(a.winner_id) if a.winner_id else None,
            starts_at=a.starts_at, ends_at=a.ends_at, ends_at_extended=a.ends_at_extended,
            anti_sniping_window_seconds=a.anti_sniping_window_seconds,
            extensions_count=a.extensions_count, max_extensions=a.max_extensions,
            has_delivery_code=a.delivery_code is not None, delivery_status=a.delivery_status,
            delivery_confirmed_at=a.delivery_confirmed_at,
            total_bids=total, total_participants=participants,
            min_next_bid=a.reserve_price_centavos if a.current_bid_centavos == 0 else a.current_bid_centavos + a.min_increment_centavos,
            user_position=up, user_bid_amount=ub,
            created_at=a.created_at,
        ))
    return out


@router.get("/my-wins", response_model=list[MyWinOut])
async def my_wins(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await auction_service.auto_finalize_expired(db)
    result = await db.execute(
        select(Auction).where(
            Auction.winner_id == current_user.id,
            Auction.status == AuctionStatus.FINISHED,
        ).order_by(Auction.created_at.desc())
    )
    wins = []
    for a in result.scalars().all():
        wins.append(MyWinOut(
            id=str(a.id), title=a.title, image_url=a.image_url,
            current_bid_centavos=a.current_bid_centavos,
            delivery_status=a.delivery_status,
            winner_name=a.winner.full_name if a.winner else None,
        ))
    return wins


@router.get("/{auction_id}", response_model=AuctionOut)
async def get_auction(
    auction_id: str,
    current_user: User | None = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    await auction_service.auto_finalize_expired(db)
    detail = await auction_service.get_auction_detail(
        uuid.UUID(auction_id), current_user, db,
    )
    return AuctionOut(**detail)


@router.get("/{auction_id}/history", response_model=list[BidHistoryItem])
async def get_bid_history(
    auction_id: str,
    current_user: User | None = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await auction_service.get_bid_history(
        uuid.UUID(auction_id), current_user, db,
    )


@router.get("/{auction_id}/participants", response_model=list[ParticipantOut])
async def get_participants(
    auction_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await auction_service.get_participants(
        uuid.UUID(auction_id), current_user, db,
    )


@router.post("/{auction_id}/bid", response_model=PlaceBidOut)
async def place_bid(
    auction_id: str,
    body: PlaceBidRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bid = await auction_service.place_bid(
        uuid.UUID(auction_id), body.amount_centavos, current_user, db,
    )
    await db.commit()
    await db.refresh(bid)
    return PlaceBidOut(
        id=str(bid.id), auction_id=str(bid.auction_id),
        amount_centavos=bid.amount_centavos, is_winning=bid.is_winning,
        created_at=bid.created_at,
    )


@router.post("/{auction_id}/finalize", response_model=AuctionOut)
async def finalize_auction_endpoint(
    auction_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Auction).where(Auction.id == uuid.UUID(auction_id)).with_for_update()
    )
    auction = result.scalar_one_or_none()
    if not auction:
        raise HTTPException(status_code=404, detail="Leilão não encontrado.")
    if str(auction.creator_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Apenas o criador pode finalizar.")

    auction = await auction_service.finalize_auction(uuid.UUID(auction_id), db)
    await db.commit()
    await db.refresh(auction)
    return AuctionOut(
        id=str(auction.id), creator_id=str(auction.creator_id),
        title=auction.title, description=auction.description,
        image_url=auction.image_url,
        starting_bid_centavos=auction.starting_bid_centavos,
        reserve_price_centavos=auction.reserve_price_centavos,
        current_bid_centavos=auction.current_bid_centavos,
        min_increment_centavos=auction.min_increment_centavos,
        pool_held_centavos=auction.pool_held_centavos,
        status=auction.status,
        winner_id=str(auction.winner_id) if auction.winner_id else None,
        starts_at=auction.starts_at, ends_at=auction.ends_at, ends_at_extended=auction.ends_at_extended,
        anti_sniping_window_seconds=auction.anti_sniping_window_seconds,
        extensions_count=auction.extensions_count,
        max_extensions=auction.max_extensions,
        has_delivery_code=auction.delivery_code is not None,
        delivery_status=auction.delivery_status,
        delivery_confirmed_at=auction.delivery_confirmed_at,
        total_bids=0, total_participants=0,
        min_next_bid=auction.reserve_price_centavos if auction.current_bid_centavos == 0 else auction.current_bid_centavos + auction.min_increment_centavos,
        created_at=auction.created_at,
    )

@router.get("/{auction_id}/delivery", response_model=DeliveryStatusOut)
async def auction_delivery_status(
    auction_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return delivery code + status for the winner of an auction."""
    result = await db.execute(
        select(Auction).where(Auction.id == uuid.UUID(auction_id))
    )
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Leilão não encontrado.")
    if str(a.winner_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Apenas o vencedor pode ver o código de entrega.")
    return DeliveryStatusOut(
        id=str(a.id), title=a.title, image_url=a.image_url,
        current_bid_centavos=a.current_bid_centavos,
        delivery_code=a.delivery_code,
        delivery_status=a.delivery_status,
        status=a.status,
    )


# ── Delivery routes ───────────────────────────────────────────────────────────

@router.get("/delivery/code/{code}", response_model=DeliveryLookupOut)
async def delivery_lookup(
    code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await auction_service.delivery_lookup_by_code(code, current_user, db)


@router.post("/delivery/code/{code}/confirm", response_model=DeliveryConfirmOut)
async def delivery_confirm(
    code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await auction_service.confirm_delivery_by_code(code, current_user, db)
    await db.commit()
    return result
