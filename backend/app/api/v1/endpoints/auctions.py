"""
Auctions (Leilões) endpoints.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.auction import Auction, AuctionStatus, Bid
from app.models.user import User
from app.models.wallet import Transaction, TransactionStatus, TransactionType, Wallet
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
    current_bid_centavos: int
    min_increment_centavos: int
    status: str
    winner_id: str | None
    ends_at: datetime
    created_at: datetime
    total_bids: int


class BidOut(BaseModel):
    id: str
    auction_id: str
    user_id: str
    amount_centavos: int
    is_winning: bool
    created_at: datetime


class PlaceBidRequest(BaseModel):
    amount_centavos: int


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_wallet(user_id: uuid.UUID, db: AsyncSession) -> Wallet:
    result = await db.execute(select(Wallet).where(Wallet.user_id == user_id))
    wallet = result.scalar_one_or_none()
    if not wallet:
        raise HTTPException(status_code=400, detail="Carteira não encontrada.")
    return wallet


def _auction_out(a: Auction, total_bids: int = 0) -> AuctionOut:
    return AuctionOut(
        id=str(a.id),
        creator_id=str(a.creator_id),
        title=a.title,
        description=a.description,
        image_url=a.image_url,
        starting_bid_centavos=a.starting_bid_centavos,
        current_bid_centavos=a.current_bid_centavos,
        min_increment_centavos=a.min_increment_centavos,
        status=a.status,
        winner_id=str(a.winner_id) if a.winner_id else None,
        ends_at=a.ends_at,
        created_at=a.created_at,
        total_bids=total_bids,
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[AuctionOut])
async def list_auctions(
    status: str = Query("active"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    q = select(Auction).order_by(Auction.created_at.desc()).limit(limit).offset(offset)
    if status != "all":
        q = q.where(Auction.status == status)
    result = await db.execute(q)
    auctions = result.scalars().all()
    out = []
    for a in auctions:
        bids_result = await db.execute(select(Bid).where(Bid.auction_id == a.id))
        total = len(bids_result.scalars().all())
        out.append(_auction_out(a, total))
    return out


@router.post("", response_model=AuctionOut)
async def create_auction(
    title: str = Form(...),
    description: str = Form(...),
    starting_bid_centavos: int = Form(..., gt=0),
    min_increment_centavos: int = Form(100, gt=0),
    ends_at: datetime = Form(...),
    image: UploadFile | None = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    image_url = None
    if image and image.filename:
        image_url = await upload_image(image, folder="kalie/auctions")

    auction = Auction(
        creator_id=current_user.id,
        title=title,
        description=description,
        image_url=image_url,
        starting_bid_centavos=starting_bid_centavos,
        current_bid_centavos=starting_bid_centavos,
        min_increment_centavos=min_increment_centavos,
        status=AuctionStatus.ACTIVE,
        ends_at=ends_at,
    )
    db.add(auction)
    await db.commit()
    await db.refresh(auction)
    return _auction_out(auction, 0)


@router.get("/{auction_id}", response_model=AuctionOut)
async def get_auction(auction_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Auction).where(Auction.id == uuid.UUID(auction_id)))
    auction = result.scalar_one_or_none()
    if not auction:
        raise HTTPException(status_code=404, detail="Leilão não encontrado.")
    bids_result = await db.execute(select(Bid).where(Bid.auction_id == auction.id))
    total = len(bids_result.scalars().all())
    return _auction_out(auction, total)


@router.post("/{auction_id}/bid", response_model=BidOut)
async def place_bid(
    auction_id: str,
    body: PlaceBidRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Auction).where(Auction.id == uuid.UUID(auction_id)))
    auction = result.scalar_one_or_none()
    if not auction:
        raise HTTPException(status_code=404, detail="Leilão não encontrado.")
    if auction.status != AuctionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Este leilão já não está activo.")
    if datetime.now(timezone.utc) > auction.ends_at:
        raise HTTPException(status_code=400, detail="Este leilão já terminou.")
    if str(auction.creator_id) == str(current_user.id):
        raise HTTPException(status_code=400, detail="Não podes licitar no teu próprio leilão.")

    min_bid = auction.current_bid_centavos + auction.min_increment_centavos
    if body.amount_centavos < min_bid:
        raise HTTPException(status_code=400, detail=f"Lance mínimo: {min_bid} centavos.")

    wallet = await _get_wallet(current_user.id, db)
    if wallet.available_centavos < body.amount_centavos:
        raise HTTPException(status_code=400, detail="Saldo insuficiente.")

    # Lock funds
    wallet.locked_centavos += body.amount_centavos

    # Unlock previous winning bid
    prev_result = await db.execute(
        select(Bid).where(Bid.auction_id == auction.id).where(Bid.is_winning == True)
    )
    prev_winning = prev_result.scalar_one_or_none()
    if prev_winning:
        prev_winning.is_winning = False
        prev_wallet_result = await db.execute(select(Wallet).where(Wallet.user_id == prev_winning.user_id))
        prev_wallet = prev_wallet_result.scalar_one_or_none()
        if prev_wallet:
            prev_wallet.locked_centavos = max(0, prev_wallet.locked_centavos - prev_winning.amount_centavos)

    bid = Bid(
        auction_id=auction.id,
        user_id=current_user.id,
        amount_centavos=body.amount_centavos,
        is_winning=True,
    )
    auction.current_bid_centavos = body.amount_centavos
    db.add(bid)
    await db.commit()
    await db.refresh(bid)

    return BidOut(
        id=str(bid.id),
        auction_id=str(bid.auction_id),
        user_id=str(bid.user_id),
        amount_centavos=bid.amount_centavos,
        is_winning=bid.is_winning,
        created_at=bid.created_at,
    )


@router.get("/{auction_id}/bids", response_model=list[BidOut])
async def get_bids(
    auction_id: str,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Bid)
        .where(Bid.auction_id == uuid.UUID(auction_id))
        .order_by(Bid.created_at.desc())
        .limit(limit)
    )
    bids = result.scalars().all()
    return [BidOut(
        id=str(b.id), auction_id=str(b.auction_id), user_id=str(b.user_id),
        amount_centavos=b.amount_centavos, is_winning=b.is_winning, created_at=b.created_at,
    ) for b in bids]


@router.post("/{auction_id}/finalize", response_model=AuctionOut)
async def finalize_auction(
    auction_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Finalize auction — transfer funds from winner to creator."""
    result = await db.execute(select(Auction).where(Auction.id == uuid.UUID(auction_id)))
    auction = result.scalar_one_or_none()
    if not auction:
        raise HTTPException(status_code=404, detail="Leilão não encontrado.")
    if str(auction.creator_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Apenas o criador pode finalizar.")
    if auction.status != AuctionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Leilão já finalizado.")

    # Find winning bid
    bid_result = await db.execute(
        select(Bid).where(Bid.auction_id == auction.id).where(Bid.is_winning == True)
    )
    winning_bid = bid_result.scalar_one_or_none()

    auction.status = AuctionStatus.FINISHED
    if winning_bid:
        auction.winner_id = winning_bid.user_id
        # Debit winner, credit creator
        winner_wallet_result = await db.execute(select(Wallet).where(Wallet.user_id == winning_bid.user_id))
        winner_wallet = winner_wallet_result.scalar_one_or_none()
        creator_wallet_result = await db.execute(select(Wallet).where(Wallet.user_id == auction.creator_id))
        creator_wallet = creator_wallet_result.scalar_one_or_none()

        if winner_wallet and creator_wallet:
            winner_wallet.balance_centavos -= winning_bid.amount_centavos
            winner_wallet.locked_centavos = max(0, winner_wallet.locked_centavos - winning_bid.amount_centavos)
            creator_wallet.balance_centavos += winning_bid.amount_centavos

            now = datetime.now(timezone.utc)
            db.add(Transaction(
                wallet_id=winner_wallet.id, idempotency_key=str(uuid.uuid4()),
                type=TransactionType.AUCTION_BID, status=TransactionStatus.COMPLETED,
                amount_centavos=winning_bid.amount_centavos,
                balance_after_centavos=winner_wallet.balance_centavos,
                description=f"Leilão ganho: {auction.title}", created_at=now,
            ))
            db.add(Transaction(
                wallet_id=creator_wallet.id, idempotency_key=str(uuid.uuid4()),
                type=TransactionType.TRANSFER_IN, status=TransactionStatus.COMPLETED,
                amount_centavos=winning_bid.amount_centavos,
                balance_after_centavos=creator_wallet.balance_centavos,
                description=f"Leilão vendido: {auction.title}", created_at=now,
            ))

    await db.commit()
    await db.refresh(auction)
    return _auction_out(auction)
