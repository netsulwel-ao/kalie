"""
Raffles (Rifas) endpoints — CRUD, draft activation, atomic ticket purchase,
auto-close, Provably Fair draw, reservation, and cancellation with refunds.
"""
import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.raffle import DeliveryCode, DeliveryStatus, Raffle, RaffleStatus, RaffleTicket, RaffleTicketStatus
from app.models.user import User
from app.models.wallet import Transaction, TransactionStatus, TransactionType, Wallet
from app.services.cloudinary_service import upload_image
from app.services.delivery_service import (
    confirm_by_code, confirm_by_creator, confirm_by_code_creator,
    generate_delivery_code, get_delivery_status, open_dispute,
)
from app.services.raffle_service import (
    pre_generate_tickets, reserve_ticket, confirm_purchase,
    release_reservation, search_available_tickets,
    cancel_raffle_with_refunds, get_participants, anonymize_name,
)

router = APIRouter(prefix="/raffles", tags=["raffles"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class RaffleOut(BaseModel):
    id: str
    creator_id: str
    title: str
    description: str
    image_url: str | None
    video_url: str | None
    ticket_price_centavos: int
    max_tickets: int
    tickets_sold: int
    min_tickets_for_draw: int
    pool_held_centavos: int
    total_raised_centavos: int
    buyer_count: int
    status: str
    server_seed_hash: str
    server_seed: str | None = None
    client_seed: str | None = None
    nonce: int = 0
    winner_id: str | None
    winning_ticket: int | None
    ends_at: datetime | None
    starts_at: datetime | None
    created_at: datetime
    activated_at: datetime | None
    drawn_at: datetime | None
    is_auto_closed: bool
    pct_sold: float

    class Config:
        from_attributes = True


class RaffleTicketOut(BaseModel):
    id: str
    raffle_id: str
    ticket_number: int
    status: str
    purchased_at: datetime | None


class RaffleTicketFullOut(BaseModel):
    id: str
    ticket_number: int
    status: str
    purchased_at: datetime | None


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_wallet(user_id: uuid.UUID, db: AsyncSession) -> Wallet:
    result = await db.execute(select(Wallet).where(Wallet.user_id == user_id))
    wallet = result.scalar_one_or_none()
    if not wallet:
        raise HTTPException(status_code=400, detail="Carteira não encontrada. Acede à carteira primeiro.")
    return wallet


def _raffle_out(r: Raffle, buyer_count: int = 0) -> RaffleOut:
    return RaffleOut(
        id=str(r.id),
        creator_id=str(r.creator_id),
        title=r.title,
        description=r.description,
        image_url=r.image_url,
        video_url=r.video_url,
        ticket_price_centavos=r.ticket_price_centavos,
        max_tickets=r.max_tickets,
        tickets_sold=r.tickets_sold,
        min_tickets_for_draw=r.min_tickets_for_draw,
        pool_held_centavos=r.pool_held_centavos,
        total_raised_centavos=r.ticket_price_centavos * r.tickets_sold,
        buyer_count=buyer_count,
        status=r.status,
        server_seed_hash=r.server_seed_hash,
        server_seed=r.server_seed if r.status == RaffleStatus.FINISHED else None,
        client_seed=r.client_seed,
        nonce=r.nonce,
        winner_id=str(r.winner_id) if r.winner_id else None,
        winning_ticket=r.winning_ticket,
        ends_at=r.ends_at,
        starts_at=r.starts_at,
        created_at=r.created_at,
        activated_at=r.activated_at,
        drawn_at=r.drawn_at,
        is_auto_closed=r.is_auto_closed,
        pct_sold=r.pct_sold(),
    )


async def _count_buyers(raffle_id: uuid.UUID, db: AsyncSession) -> int:
    from sqlalchemy import func
    result = await db.execute(
        select(func.count(func.distinct(RaffleTicket.user_id)))
        .where(RaffleTicket.raffle_id == raffle_id, RaffleTicket.status == RaffleTicketStatus.SOLD)
    )
    return result.scalar() or 0


async def _can_auto_close(raffle: Raffle) -> bool:
    """Check if the raffle meets automatic close conditions."""
    now = datetime.now(timezone.utc)
    return (
        raffle.status == RaffleStatus.ACTIVE
        and (raffle.tickets_sold >= raffle.max_tickets or (raffle.ends_at is not None and now >= raffle.ends_at))
    )


async def _auto_close_expired(db: AsyncSession) -> None:
    """Auto-close any active raffles past their end time or fully sold."""
    now = datetime.now(timezone.utc)
    # Raffles with ends_at that have passed
    expired_q = select(Raffle).where(
        Raffle.status == RaffleStatus.ACTIVE,
        Raffle.ends_at.isnot(None),
        Raffle.ends_at <= now,
    ).with_for_update()
    result = await db.execute(expired_q)
    # Raffles sold out (with or without ends_at)
    sold_out_q = select(Raffle).where(
        Raffle.status == RaffleStatus.ACTIVE,
        Raffle.tickets_sold >= Raffle.max_tickets,
    ).with_for_update()
    sold_out_result = await db.execute(sold_out_q)
    seen_ids: set[uuid.UUID] = set()
    expired: list[Raffle] = []
    for r in result.scalars().all() + sold_out_result.scalars().all():
        if r.id not in seen_ids:
            seen_ids.add(r.id)
            expired.append(r)
    for raffle in expired:
        if raffle.tickets_sold == 0:
            raffle.status = RaffleStatus.CANCELLED
            continue
        # Draw winner
        tickets_result = await db.execute(
            select(RaffleTicket)
            .where(RaffleTicket.raffle_id == raffle.id, RaffleTicket.status == RaffleTicketStatus.SOLD)
        )
        sold_tickets = tickets_result.scalars().all()
        if not sold_tickets:
            raffle.status = RaffleStatus.CANCELLED
            continue
        client_seed = secrets.token_hex(16)
        raffle.client_seed = client_seed
        raffle.nonce += 1
        message = f"{client_seed}:{raffle.nonce}"
        h = hmac.new(raffle.server_seed.encode(), message.encode(), hashlib.sha256).hexdigest()
        fair_index = int(h[:8], 16) % len(sold_tickets)
        winning_ticket_obj = sold_tickets[fair_index]
        raffle.winning_ticket = winning_ticket_obj.ticket_number
        raffle.winner_id = winning_ticket_obj.user_id
        raffle.status = RaffleStatus.FINISHED
        raffle.drawn_at = now
        raffle.is_auto_closed = True
        # Generate delivery code instead of crediting winner directly
        if winning_ticket_obj.user_id:
            await generate_delivery_code(raffle, winning_ticket_obj.user_id, db)
    if expired:
        await db.commit()


async def _auto_activate_scheduled(db: AsyncSession) -> None:
    """Auto-activate any draft raffles whose starts_at has passed."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Raffle).where(
            Raffle.status == RaffleStatus.DRAFT,
            Raffle.starts_at.isnot(None),
            Raffle.starts_at <= now,
        ).with_for_update()
    )
    drafts = result.scalars().all()
    for raffle in drafts:
        raffle.status = RaffleStatus.ACTIVE
        raffle.activated_at = now
        await pre_generate_tickets(raffle, db)
    if drafts:
        await db.commit()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[RaffleOut])
async def list_raffles(
    status: str = Query("active"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    try:
        await _auto_activate_scheduled(db)
    except Exception:
        pass
    try:
        await _auto_close_expired(db)
    except Exception:
        pass  # never break the list on auto-close failure

    now = datetime.now(timezone.utc)
    q = select(Raffle).order_by(Raffle.created_at.desc()).limit(limit).offset(offset)
    if status != "all":
        q = q.where(Raffle.status == status)
        # Safety filter: never show expired/sold-out raffles in "active" tab
        if status == "active":
            q = q.where(
                or_(Raffle.ends_at == None, Raffle.ends_at > now, Raffle.tickets_sold < Raffle.max_tickets)
            )
    result = await db.execute(q)
    raffles = result.scalars().all()
    out = []
    for r in raffles:
        bc = await _count_buyers(r.id, db)
        out.append(_raffle_out(r, bc))
    return out


@router.post("", response_model=RaffleOut)
async def create_raffle(
    title: str = Form(...),
    description: str = Form(...),
    ticket_price_centavos: int = Form(..., gt=0),
    max_tickets: int = Form(..., gt=0, le=100000),
    starts_at: datetime | None = Form(None),
    ends_at: datetime | None = Form(None),
    image: UploadFile | None = File(None),
    video_url: str | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a raffle in draft status. Activate separately or auto-activate at starts_at."""
    if ends_at and ends_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="A data de encerramento deve ser futura.")
    if starts_at and starts_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="A data de início deve ser futura.")
    if starts_at and ends_at and starts_at >= ends_at:
        raise HTTPException(status_code=400, detail="A data de início deve ser anterior à data de encerramento.")

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
        video_url=video_url,
        ticket_price_centavos=ticket_price_centavos,
        max_tickets=max_tickets,
        tickets_sold=0,
        status=RaffleStatus.DRAFT,
        server_seed=server_seed,
        server_seed_hash=server_seed_hash,
        starts_at=starts_at,
        ends_at=ends_at,
    )
    db.add(raffle)
    await db.commit()
    await db.refresh(raffle)
    return _raffle_out(raffle)


@router.get("/{raffle_id}", response_model=RaffleOut)
async def get_raffle(raffle_id: str, db: AsyncSession = Depends(get_db)):
    try:
        await _auto_activate_scheduled(db)
    except Exception:
        pass
    await _auto_close_expired(db)
    result = await db.execute(select(Raffle).where(Raffle.id == uuid.UUID(raffle_id)))
    raffle = result.scalar_one_or_none()
    if not raffle:
        raise HTTPException(status_code=404, detail="Sorteio não encontrado.")
    bc = await _count_buyers(raffle.id, db)
    return _raffle_out(raffle, bc)


@router.post("/{raffle_id}/activate", response_model=RaffleOut)
async def activate_raffle(
    raffle_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Activate a draft raffle. Only the creator can activate."""
    result = await db.execute(select(Raffle).where(Raffle.id == uuid.UUID(raffle_id)))
    raffle = result.scalar_one_or_none()
    if not raffle:
        raise HTTPException(status_code=404, detail="Sorteio não encontrado.")
    if str(raffle.creator_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Apenas o criador pode activar o sorteio.")
    if raffle.status != RaffleStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Apenas sorteios em rascunho podem ser activados.")

    raffle.status = RaffleStatus.ACTIVE
    raffle.activated_at = datetime.now(timezone.utc)
    await pre_generate_tickets(raffle, db)
    await db.commit()
    await db.refresh(raffle)
    return _raffle_out(raffle)


@router.post("/{raffle_id}/tickets", response_model=RaffleTicketOut)
async def buy_ticket(
    raffle_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Buy a single ticket. Uses row-level locking for concurrency safety."""
    # Lock the raffle row to prevent concurrent purchases
    result = await db.execute(
        select(Raffle).where(Raffle.id == uuid.UUID(raffle_id)).with_for_update()
    )
    raffle = result.scalar_one_or_none()
    if not raffle:
        raise HTTPException(status_code=404, detail="Sorteio não encontrado.")
    if raffle.status != RaffleStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Este sorteio não está activo.")
    if raffle.tickets_sold >= raffle.max_tickets:
        raise HTTPException(status_code=400, detail="Todos os bilhetes foram vendidos.")
    if raffle.ends_at and datetime.now(timezone.utc) > raffle.ends_at:
        raise HTTPException(status_code=400, detail="Este sorteio já terminou.")
    if str(raffle.creator_id) == str(current_user.id):
        raise HTTPException(status_code=400, detail="O criador não pode comprar bilhetes no seu próprio sorteio.")

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
        description=f"Bilhete sorteio: {raffle.title}",
        created_at=datetime.now(timezone.utc),
    )
    db.add(tx)

    # Find next available ticket from pre-generated pool
    avail = await db.execute(
        select(RaffleTicket)
        .where(RaffleTicket.raffle_id == raffle.id, RaffleTicket.status == RaffleTicketStatus.AVAILABLE)
        .order_by(RaffleTicket.ticket_number)
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    ticket = avail.scalar_one_or_none()

    if ticket:
        # Pre-generated pool exists — assign
        ticket.status = RaffleTicketStatus.SOLD
        ticket.user_id = current_user.id
        ticket.purchased_at = datetime.now(timezone.utc)
        raffle.tickets_sold += 1
        raffle.pool_held_centavos += raffle.ticket_price_centavos
    else:
        # Fallback: create new (legacy / no pre-generation)
        ticket_number = raffle.tickets_sold + 1
        ticket = RaffleTicket(
            raffle_id=raffle.id,
            user_id=current_user.id,
            ticket_number=ticket_number,
            status=RaffleTicketStatus.SOLD,
            purchased_at=datetime.now(timezone.utc),
        )
        raffle.tickets_sold += 1
        raffle.pool_held_centavos += raffle.ticket_price_centavos
        db.add(ticket)

    await db.commit()
    await db.refresh(ticket)

    return RaffleTicketOut(
        id=str(ticket.id),
        raffle_id=str(ticket.raffle_id),
        ticket_number=ticket.ticket_number,
        status=ticket.status.value if ticket.status else "sold",
        purchased_at=ticket.purchased_at,
    )


@router.get("/{raffle_id}/my-tickets", response_model=list[RaffleTicketOut])
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
    return [
        RaffleTicketOut(
            id=str(t.id), raffle_id=str(t.raffle_id),
            ticket_number=t.ticket_number, status=t.status.value if isinstance(t.status, RaffleTicketStatus) else (t.status or "available"),
            purchased_at=t.purchased_at,
        )
        for t in result.scalars().all()
    ]


@router.get("/{raffle_id}/all-tickets", response_model=list[RaffleTicketFullOut])
async def list_all_tickets(
    raffle_id: str,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List ALL tickets (available, reserved, sold) with their status."""
    result = await db.execute(
        select(RaffleTicket)
        .where(RaffleTicket.raffle_id == uuid.UUID(raffle_id))
        .order_by(RaffleTicket.ticket_number)
        .limit(limit)
        .offset(offset)
    )
    return [
        RaffleTicketFullOut(
            id=str(t.id),
            ticket_number=t.ticket_number,
            status=t.status.value if isinstance(t.status, RaffleTicketStatus) else (t.status or "available"),
            purchased_at=t.purchased_at,
        )
        for t in result.scalars().all()
    ]


@router.get("/{raffle_id}/tickets", response_model=list[RaffleTicketOut])
async def list_tickets(
    raffle_id: str,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List all purchased tickets for a raffle (public)."""
    result = await db.execute(
        select(RaffleTicket)
        .where(RaffleTicket.raffle_id == uuid.UUID(raffle_id))
        .order_by(RaffleTicket.ticket_number)
        .limit(limit)
        .offset(offset)
    )
    return [
        RaffleTicketOut(
            id=str(t.id), raffle_id=str(t.raffle_id),
            ticket_number=t.ticket_number, status=t.status.value if isinstance(t.status, RaffleTicketStatus) else (t.status or "available"),
            purchased_at=t.purchased_at,
        )
        for t in result.scalars().all()
    ]


@router.post("/{raffle_id}/close", response_model=RaffleOut)
async def close_raffle(
    raffle_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Close raffle and draw winner.
    Can be triggered automatically by the system or manually by the creator
    when conditions are met (time ended or all tickets sold).
    Uses HMAC-SHA256 for provably fair winner selection.
    """
    result = await db.execute(
        select(Raffle).where(Raffle.id == uuid.UUID(raffle_id)).with_for_update()
    )
    raffle = result.scalar_one_or_none()
    if not raffle:
        raise HTTPException(status_code=404, detail="Sorteio não encontrado.")
    if raffle.status == RaffleStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Sorteio em rascunho. Active primeiro.")
    if raffle.status != RaffleStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Sorteio já foi realizado ou cancelado.")
    if raffle.tickets_sold == 0:
        raise HTTPException(status_code=400, detail="Nenhum bilhete vendido.")

    # Only creator or auto-close can trigger this
    is_creator = str(raffle.creator_id) == str(current_user.id)
    can_auto_close = await _can_auto_close(raffle)
    if not is_creator and not can_auto_close:
        raise HTTPException(
            status_code=403,
            detail="Apenas o criador pode encerrar, ou aguarde o fim do prazo/venda total.",
        )

    # Collect sold tickets for winner selection
    tickets_result = await db.execute(
        select(RaffleTicket)
        .where(RaffleTicket.raffle_id == raffle.id, RaffleTicket.status == RaffleTicketStatus.SOLD)
        .order_by(RaffleTicket.ticket_number)
    )
    sold_tickets = tickets_result.scalars().all()

    if not sold_tickets:
        raise HTTPException(status_code=400, detail="Nenhum bilhete vendido.")

    # Provably Fair winner selection using HMAC-SHA256
    client_seed = secrets.token_hex(16)
    raffle.client_seed = client_seed
    raffle.nonce += 1
    message = f"{client_seed}:{raffle.nonce}"
    h = hmac.new(
        raffle.server_seed.encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()
    fair_index = int(h[:8], 16) % raffle.tickets_sold
    winning_ticket_obj = sold_tickets[fair_index]
    raffle.winning_ticket = winning_ticket_obj.ticket_number
    raffle.winner_id = winning_ticket_obj.user_id
    raffle.status = RaffleStatus.FINISHED
    raffle.drawn_at = datetime.now(timezone.utc)
    raffle.is_auto_closed = not is_creator

    # Generate delivery code instead of crediting winner directly
    # Funds remain in escrow (pool_held_centavos) until delivery confirmation
    if winning_ticket_obj.user_id:
        await generate_delivery_code(raffle, winning_ticket_obj.user_id, db)

    await db.commit()
    await db.refresh(raffle)
    return _raffle_out(raffle)


@router.post("/{raffle_id}/cancel", response_model=RaffleOut)
async def cancel_raffle(
    raffle_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Cancel a raffle.
    - Draft: cancel freely (no tickets sold).
    - Active with sales: only if below min_tickets_for_draw.
      All buyers are auto-refunded.
    """
    result = await db.execute(
        select(Raffle).where(Raffle.id == uuid.UUID(raffle_id)).with_for_update()
    )
    raffle = result.scalar_one_or_none()
    if not raffle:
        raise HTTPException(status_code=404, detail="Sorteio não encontrado.")
    if str(raffle.creator_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Apenas o criador pode cancelar.")

    if raffle.status == RaffleStatus.DRAFT:
        raffle.status = RaffleStatus.CANCELLED
        await db.commit()
        await db.refresh(raffle)
        return _raffle_out(raffle)

    if raffle.status != RaffleStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Sorteio já foi realizado ou cancelado.")

    # Active with sales — check min threshold and refund
    if raffle.tickets_sold > raffle.min_tickets_for_draw:
        raise HTTPException(
            status_code=400,
            detail=f"Vendas mínimas para sorteio: {raffle.min_tickets_for_draw}. "
                   f"Atualmente tens {raffle.tickets_sold} bilhetes vendidos.",
        )

    await cancel_raffle_with_refunds(raffle, db)
    await db.commit()
    await db.refresh(raffle)
    return _raffle_out(raffle)


# ── Extension: Reserve a specific ticket ──────────────────────────────────────

class ReserveOut(BaseModel):
    id: str
    ticket_number: int
    status: str
    reserved_until: datetime | None = None

    class Config:
        from_attributes = True


@router.post("/{raffle_id}/tickets/{ticket_number}/reserve", response_model=ReserveOut)
async def reserve_raffle_ticket(
    raffle_id: str,
    ticket_number: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reserve a specific ticket number for 1 minute."""
    result = await db.execute(
        select(Raffle).where(Raffle.id == uuid.UUID(raffle_id)).with_for_update()
    )
    raffle = result.scalar_one_or_none()
    if not raffle:
        raise HTTPException(status_code=404, detail="Sorteio não encontrado.")
    if raffle.status != RaffleStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Sorteio não está activo.")
    if str(raffle.creator_id) == str(current_user.id):
        raise HTTPException(status_code=400, detail="O criador não pode reservar no seu próprio sorteio.")

    try:
        ticket = await reserve_ticket(raffle, ticket_number, current_user, db)
        await db.commit()
        return ReserveOut(
            id=str(ticket.id),
            ticket_number=ticket.ticket_number,
            status=ticket.status,
            reserved_until=ticket.reserved_until,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Extension: Confirm purchase ───────────────────────────────────────────────

@router.post("/{raffle_id}/tickets/{ticket_id}/confirm", response_model=ReserveOut)
async def confirm_ticket_purchase(
    raffle_id: str,
    ticket_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm purchase of a reserved ticket."""
    result = await db.execute(
        select(Raffle).where(Raffle.id == uuid.UUID(raffle_id)).with_for_update()
    )
    raffle = result.scalar_one_or_none()
    if not raffle:
        raise HTTPException(status_code=404, detail="Sorteio não encontrado.")

    ticket_result = await db.execute(
        select(RaffleTicket).where(RaffleTicket.id == uuid.UUID(ticket_id)).with_for_update()
    )
    ticket = ticket_result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Bilhete não encontrado.")

    try:
        ticket = await confirm_purchase(raffle, ticket, current_user, db)
        await db.commit()
        return ReserveOut(
            id=str(ticket.id),
            ticket_number=ticket.ticket_number,
            status=ticket.status,
            reserved_until=None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Extension: Release reservation ────────────────────────────────────────────

@router.post("/{raffle_id}/tickets/{ticket_id}/release")
async def release_ticket_reservation(
    raffle_id: str,
    ticket_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Release a reserved ticket back to available pool."""
    ticket_result = await db.execute(
        select(RaffleTicket).where(RaffleTicket.id == uuid.UUID(ticket_id)).with_for_update()
    )
    ticket = ticket_result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Bilhete não encontrado.")
    if str(ticket.reserved_by_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Não foste tu que reservaste este bilhete.")

    await release_reservation(ticket, db)
    await db.commit()
    return {"message": "Reserva cancelada.", "ticket_number": ticket.ticket_number}


# ── Extension: Search available tickets ───────────────────────────────────────

class AvailableTicketOut(BaseModel):
    id: str
    ticket_number: int

    class Config:
        from_attributes = True


@router.get("/{raffle_id}/tickets/available", response_model=list[AvailableTicketOut])
async def list_available_tickets(
    raffle_id: str,
    query: str | None = Query(None, description="Número específico para pesquisar"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Search available tickets by number."""
    tickets = await search_available_tickets(
        uuid.UUID(raffle_id), query=query, limit=limit, offset=offset, db=db,
    )
    return [AvailableTicketOut(id=str(t.id), ticket_number=t.ticket_number) for t in tickets]


# ── Extension: Anonymized participants ────────────────────────────────────────

class ParticipantOut(BaseModel):
    ticket_number: int
    name: str
    purchased_at: str | None


@router.get("/{raffle_id}/participants", response_model=list[ParticipantOut])
async def list_participants(
    raffle_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get list of participants with anonymized names."""
    result = await db.execute(select(Raffle).where(Raffle.id == uuid.UUID(raffle_id)))
    raffle = result.scalar_one_or_none()
    if not raffle:
        raise HTTPException(status_code=404, detail="Sorteio não encontrado.")
    participants = await get_participants(uuid.UUID(raffle_id), db)
    return [ParticipantOut(**p) for p in participants]


# ── Code-based delivery lookup (creator enters winner's code) ───────────────────

class DeliveryCodeLookupOut(BaseModel):
    raffle_title: str
    raffle_description: str
    prize_amount_centavos: int
    delivery_status: str
    winner_name: str | None = None
    created_at: datetime
    expires_at: datetime
    dispute_reason: str | None = None


# ── Delivery confirmation schemas ──────────────────────────────────────────────

class DeliveryCodeOut(BaseModel):
    id: str
    raffle_id: str
    code: str
    qr_data: str
    status: str
    escrow_amount_centavos: int
    dual_confirmation: bool
    confirmed_by_winner_at: datetime | None = None
    confirmed_by_creator_at: datetime | None = None
    completed_at: datetime | None = None
    expires_at: datetime
    dispute_reason: str | None = None
    dispute_opened_at: datetime | None = None
    dispute_resolved_at: datetime | None = None
    dispute_resolution: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class ConfirmCodeIn(BaseModel):
    code: str


class DisputeIn(BaseModel):
    reason: str = "Não recebi o prémio"


def _delivery_out(dc: DeliveryCode) -> DeliveryCodeOut:
    return DeliveryCodeOut(
        id=str(dc.id),
        raffle_id=str(dc.raffle_id),
        code=dc.code,
        qr_data=dc.qr_data,
        status=dc.status.value if isinstance(dc.status, DeliveryStatus) else dc.status,
        escrow_amount_centavos=dc.escrow_amount_centavos,
        dual_confirmation=dc.dual_confirmation,
        confirmed_by_winner_at=dc.confirmed_by_winner_at,
        confirmed_by_creator_at=dc.confirmed_by_creator_at,
        completed_at=dc.completed_at,
        expires_at=dc.expires_at,
        dispute_reason=dc.dispute_reason,
        dispute_opened_at=dc.dispute_opened_at,
        dispute_resolved_at=dc.dispute_resolved_at,
        dispute_resolution=dc.dispute_resolution,
        created_at=dc.created_at,
    )


# ── Code-based delivery (creator enters winner's code) ─────────────────────────

@router.get("/delivery/code/{code}", response_model=DeliveryCodeLookupOut)
async def lookup_delivery_by_code(
    code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Look up a delivery code. Creator enters the winner's code to see raffle info."""
    result = await db.execute(
        select(DeliveryCode).where(DeliveryCode.code == code.upper())
    )
    dc = result.scalar_one_or_none()
    if not dc:
        raise HTTPException(status_code=404, detail="Código de entrega inválido.")

    raffle = await db.get(Raffle, dc.raffle_id)
    if not raffle or str(raffle.creator_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Não és o criador deste sorteio.")

    winner_name = None
    if dc.winner_id:
        winner = await db.get(User, dc.winner_id)
        if winner:
            w = winner.full_name or "Utilizador"
            winner_name = f"{w[:2]}***" if len(w) > 2 else "***"

    return DeliveryCodeLookupOut(
        raffle_title=raffle.title,
        raffle_description=raffle.description,
        prize_amount_centavos=dc.escrow_amount_centavos,
        delivery_status=dc.status.value if isinstance(dc.status, DeliveryStatus) else dc.status,
        winner_name=winner_name,
        created_at=dc.created_at,
        expires_at=dc.expires_at,
        dispute_reason=dc.dispute_reason,
    )


@router.post("/delivery/code/{code}/confirm", response_model=DeliveryCodeOut)
async def confirm_delivery_by_code(
    code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Creator confirms delivery by entering the code. Releases escrow to creator."""
    dc = await confirm_by_code_creator(code.upper(), current_user, db)
    await db.commit()
    return _delivery_out(dc)


# ── Delivery endpoints ─────────────────────────────────────────────────────────

@router.get("/{raffle_id}/delivery", response_model=DeliveryCodeOut | None)
async def delivery_status(
    raffle_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get delivery code and status for a raffle (public, no auth)."""
    dc = await get_delivery_status(uuid.UUID(raffle_id), db)
    if not dc:
        return None
    return _delivery_out(dc)


@router.post("/{raffle_id}/delivery/confirm", response_model=DeliveryCodeOut)
async def confirm_delivery(
    raffle_id: str,
    body: ConfirmCodeIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm delivery by entering the code. Winner validates receipt."""
    dc = await confirm_by_code(body.code, current_user, uuid.UUID(raffle_id), db)
    await db.commit()
    return _delivery_out(dc)


@router.post("/{raffle_id}/delivery/confirm-creator", response_model=DeliveryCodeOut)
async def confirm_delivery_creator(
    raffle_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Creator confirms delivery (dual-confirmation mode)."""
    dc = await confirm_by_creator(uuid.UUID(raffle_id), current_user, db)
    await db.commit()
    return _delivery_out(dc)


@router.post("/{raffle_id}/delivery/dispute", response_model=DeliveryCodeOut)
async def dispute_delivery(
    raffle_id: str,
    body: DisputeIn = DisputeIn(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Open a dispute for a delivery."""
    dc = await open_dispute(uuid.UUID(raffle_id), current_user, db, reason=body.reason)
    await db.commit()
    return _delivery_out(dc)


# ── Extension: Set minimum sales threshold ────────────────────────────────────

class MinSalesOut(BaseModel):
    min_tickets_for_draw: int


@router.patch("/{raffle_id}/min-sales", response_model=MinSalesOut)
async def set_min_sales(
    raffle_id: str,
    body: MinSalesOut,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set minimum sales required for the draw to proceed."""
    result = await db.execute(select(Raffle).where(Raffle.id == uuid.UUID(raffle_id)))
    raffle = result.scalar_one_or_none()
    if not raffle:
        raise HTTPException(status_code=404, detail="Sorteio não encontrado.")
    if str(raffle.creator_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Apenas o criador pode definir este valor.")
    if body.min_tickets_for_draw < 0 or body.min_tickets_for_draw > raffle.max_tickets:
        raise HTTPException(status_code=400, detail="Valor inválido.")
    raffle.min_tickets_for_draw = body.min_tickets_for_draw
    await db.commit()
    return MinSalesOut(min_tickets_for_draw=raffle.min_tickets_for_draw)
