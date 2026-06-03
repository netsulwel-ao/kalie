"""
Raffles (Rifas) endpoints — CRUD, ticket purchase, Provably Fair draw.
"""
import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.raffle import Raffle, RaffleStatus, RaffleTicket
from app.models.user import User
from app.models.wallet import Transaction, TransactionStatus, TransactionType, Wallet
from app.services.cloudinary_service import upload_image

router = APIRouter(prefix="/raffles", tags=["raffles"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class RaffleOut(BaseModel):
    id: str
    creator_id: str
    title: str
    description: str
    image_url: str | None
    ticket_price_centavos: int
    max_tickets: int
    tickets_sold: int
    status: str
    server_seed_hash: str
    winner_id: str | None
    winning_ticket: int | None
    ends_at: datetime
    created_at: datetime
    pct_sold: float

    class Config:
        from_attributes = True


class TicketOut(BaseModel):
    id: str
    raffle_id: str
    ticket_number: int
    purchased_at: datetime


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_wallet(user_id: uuid.UUID, db: AsyncSession) -> Wallet:
    result = await db.execute(select(Wallet).where(Wallet.user_id == user_id))
    wallet = result.scalar_one_or_none()
    if not wallet:
        raise HTTPException(status_code=400, detail="Carteira não encontrada. Acede à carteira primeiro.")
    return wallet


def _provably_fair_draw(server_seed: str, client_seed: str, nonce: int, max_tickets: int) -> int:
    """HMAC-SHA256 Provably Fair draw — returns winning ticket number (1-indexed)."""
    message = f"{client_seed}:{nonce}"
    h = hmac.new(server_seed.encode(), message.encode(), hashlib.sha256).hexdigest()
    # Use first 8 hex chars as uint32
    result = int(h[:8], 16) % max_tickets
    return result + 1  # 1-indexed


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[RaffleOut])
async def list_raffles(
    status: str = Query("active"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    q = select(Raffle).order_by(Raffle.created_at.desc()).limit(limit).offset(offset)
    if status != "all":
        q = q.where(Raffle.status == status)
    result = await db.execute(q)
    raffles = result.scalars().all()
    return [_raffle_out(r) for r in raffles]


@router.post("", response_model=RaffleOut)
async def create_raffle(
    title: str = Form(...),
    description: str = Form(...),
    ticket_price_centavos: int = Form(..., gt=0),
    max_tickets: int = Form(..., gt=0),
    ends_at: datetime = Form(...),
    image: UploadFile | None = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    image_url = None
    if image and image.filename:
        image_url = await upload_image(image, folder="kalie/raffles")

    server_seed = secrets.token_hex(32)
    server_seed_hash = hashlib.sha256(server_seed.encode()).hexdigest()

    raffle = Raffle(
        creator_id=current_user.id,
        title=title,
        description=description,
        image_url=image_url,
        ticket_price_centavos=ticket_price_centavos,
        max_tickets=max_tickets,
        tickets_sold=0,
        status=RaffleStatus.ACTIVE,
        server_seed=server_seed,
        server_seed_hash=server_seed_hash,
        ends_at=ends_at,
    )
    db.add(raffle)
    await db.commit()
    await db.refresh(raffle)
    return _raffle_out(raffle)


@router.get("/{raffle_id}", response_model=RaffleOut)
async def get_raffle(raffle_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Raffle).where(Raffle.id == uuid.UUID(raffle_id)))
    raffle = result.scalar_one_or_none()
    if not raffle:
        raise HTTPException(status_code=404, detail="Rifa não encontrada.")
    return _raffle_out(raffle)


@router.post("/{raffle_id}/tickets", response_model=TicketOut)
async def buy_ticket(
    raffle_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Raffle).where(Raffle.id == uuid.UUID(raffle_id)))
    raffle = result.scalar_one_or_none()
    if not raffle:
        raise HTTPException(status_code=404, detail="Rifa não encontrada.")
    if raffle.status != RaffleStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Esta rifa já não está activa.")
    if raffle.tickets_sold >= raffle.max_tickets:
        raise HTTPException(status_code=400, detail="Todos os bilhetes foram vendidos.")
    if datetime.now(timezone.utc) > raffle.ends_at:
        raise HTTPException(status_code=400, detail="Esta rifa já terminou.")

    wallet = await _get_wallet(current_user.id, db)
    if wallet.available_centavos < raffle.ticket_price_centavos:
        raise HTTPException(status_code=400, detail="Saldo insuficiente.")

    # Debit wallet
    wallet.balance_centavos -= raffle.ticket_price_centavos
    tx = Transaction(
        wallet_id=wallet.id,
        idempotency_key=str(uuid.uuid4()),
        type=TransactionType.RAFFLE_ENTRY,
        status=TransactionStatus.COMPLETED,
        amount_centavos=raffle.ticket_price_centavos,
        balance_after_centavos=wallet.balance_centavos,
        description=f"Bilhete rifa: {raffle.title}",
        created_at=datetime.now(timezone.utc),
    )
    db.add(tx)

    # Create ticket
    ticket_number = raffle.tickets_sold + 1
    ticket = RaffleTicket(
        raffle_id=raffle.id,
        user_id=current_user.id,
        ticket_number=ticket_number,
    )
    raffle.tickets_sold += 1
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)

    return TicketOut(
        id=str(ticket.id),
        raffle_id=str(ticket.raffle_id),
        ticket_number=ticket.ticket_number,
        purchased_at=ticket.purchased_at,
    )


@router.get("/{raffle_id}/my-tickets", response_model=list[TicketOut])
async def my_tickets(
    raffle_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RaffleTicket)
        .where(RaffleTicket.raffle_id == uuid.UUID(raffle_id))
        .where(RaffleTicket.user_id == current_user.id)
    )
    tickets = result.scalars().all()
    return [TicketOut(id=str(t.id), raffle_id=str(t.raffle_id), ticket_number=t.ticket_number, purchased_at=t.purchased_at) for t in tickets]


@router.post("/{raffle_id}/draw", response_model=RaffleOut)
async def execute_draw(
    raffle_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute the Provably Fair draw. Only the creator can trigger this."""
    result = await db.execute(select(Raffle).where(Raffle.id == uuid.UUID(raffle_id)))
    raffle = result.scalar_one_or_none()
    if not raffle:
        raise HTTPException(status_code=404, detail="Rifa não encontrada.")
    if str(raffle.creator_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Apenas o criador pode executar o sorteio.")
    if raffle.status != RaffleStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Rifa já foi sorteada ou cancelada.")
    if raffle.tickets_sold == 0:
        raise HTTPException(status_code=400, detail="Nenhum bilhete vendido.")

    client_seed = secrets.token_hex(16)
    winning_number = _provably_fair_draw(raffle.server_seed, client_seed, raffle.nonce, raffle.tickets_sold)

    # Find winner
    ticket_result = await db.execute(
        select(RaffleTicket)
        .where(RaffleTicket.raffle_id == raffle.id)
        .where(RaffleTicket.ticket_number == winning_number)
    )
    winning_ticket = ticket_result.scalar_one_or_none()

    raffle.client_seed = client_seed
    raffle.winning_ticket = winning_number
    raffle.status = RaffleStatus.FINISHED
    if winning_ticket:
        raffle.winner_id = winning_ticket.user_id
        # Credit winner's wallet
        winner_wallet_result = await db.execute(select(Wallet).where(Wallet.user_id == winning_ticket.user_id))
        winner_wallet = winner_wallet_result.scalar_one_or_none()
        if winner_wallet:
            prize = raffle.ticket_price_centavos * raffle.tickets_sold
            winner_wallet.balance_centavos += prize
            win_tx = Transaction(
                wallet_id=winner_wallet.id,
                idempotency_key=str(uuid.uuid4()),
                type=TransactionType.RAFFLE_WIN,
                status=TransactionStatus.COMPLETED,
                amount_centavos=prize,
                balance_after_centavos=winner_wallet.balance_centavos,
                description=f"Prémio rifa: {raffle.title}",
                created_at=datetime.now(timezone.utc),
            )
            db.add(win_tx)

    await db.commit()
    await db.refresh(raffle)
    return _raffle_out(raffle)


def _raffle_out(r: Raffle) -> RaffleOut:
    pct = round((r.tickets_sold / r.max_tickets) * 100, 1) if r.max_tickets > 0 else 0
    return RaffleOut(
        id=str(r.id),
        creator_id=str(r.creator_id),
        title=r.title,
        description=r.description,
        image_url=r.image_url,
        ticket_price_centavos=r.ticket_price_centavos,
        max_tickets=r.max_tickets,
        tickets_sold=r.tickets_sold,
        status=r.status,
        server_seed_hash=r.server_seed_hash,
        winner_id=str(r.winner_id) if r.winner_id else None,
        winning_ticket=r.winning_ticket,
        ends_at=r.ends_at,
        created_at=r.created_at,
        pct_sold=pct,
    )
