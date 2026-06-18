"""
Raffle service — business logic for reservations, pre-generation,
cancellation with refunds, audit trail, and notifications.
"""
import json
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_redis
from app.models.notification import Notification
from app.models.raffle import Raffle, RaffleStatus, RaffleTicket, RaffleTicketHistory, RaffleTicketStatus
from app.models.user import User
from app.models.wallet import Transaction, TransactionStatus, TransactionType, Wallet

RESERVATION_DURATION_SECONDS = 60  # 1 minute

# ── Reservation helpers via Redis ─────────────────────────────────────────────

RESERVATION_REDIS_PREFIX = "raffle_reservation:"


async def _set_reservation_redis(ticket_id: str, user_id: str) -> None:
    redis = await get_redis()
    await redis.setex(
        f"{RESERVATION_REDIS_PREFIX}{ticket_id}",
        RESERVATION_DURATION_SECONDS,
        user_id,
    )


async def _get_reservation_redis(ticket_id: str) -> str | None:
    redis = await get_redis()
    return await redis.get(f"{RESERVATION_REDIS_PREFIX}{ticket_id}")


async def _del_reservation_redis(ticket_id: str) -> None:
    redis = await get_redis()
    await redis.delete(f"{RESERVATION_REDIS_PREFIX}{ticket_id}")


# ── Audit trail ───────────────────────────────────────────────────────────────

async def _log_ticket_history(
    db: AsyncSession,
    raffle_id: uuid.UUID,
    ticket_id: uuid.UUID | None,
    ticket_number: int,
    user_id: uuid.UUID | None,
    action: str,
    from_status: str | None = None,
    to_status: str | None = None,
    metadata_json: str | None = None,
) -> None:
    entry = RaffleTicketHistory(
        raffle_id=raffle_id,
        ticket_id=ticket_id,
        ticket_number=ticket_number,
        user_id=user_id,
        action=action,
        from_status=from_status,
        to_status=to_status,
        metadata_json=metadata_json,
    )
    db.add(entry)


# ── Notifications ─────────────────────────────────────────────────────────────

async def _notify(
    db: AsyncSession,
    user_id: uuid.UUID,
    ntype: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> None:
    notif = Notification(
        user_id=user_id,
        type=ntype,
        title=title,
        body=body,
        data=json.dumps(data) if data else None,
    )
    db.add(notif)


# ── Pre-generate tickets on activation ────────────────────────────────────────

async def pre_generate_tickets(raffle: Raffle, db: AsyncSession) -> None:
    """Pre-generate all ticket slots when a raffle is activated."""
    existing = await db.execute(
        select(RaffleTicket).where(RaffleTicket.raffle_id == raffle.id).limit(1)
    )
    if existing.scalar_one_or_none():
        return  # already pre-generated

    batch = []
    for num in range(1, raffle.max_tickets + 1):
        batch.append(RaffleTicket(
            raffle_id=raffle.id,
            ticket_number=num,
            status=RaffleTicketStatus.AVAILABLE,
        ))
    db.add_all(batch)


# ── Reserve a specific ticket ─────────────────────────────────────────────────

async def reserve_ticket(
    raffle: Raffle,
    ticket_number: int,
    user: User,
    db: AsyncSession,
) -> RaffleTicket:
    """Reserve a specific ticket number for 1 minute."""
    result = await db.execute(
        select(RaffleTicket)
        .where(RaffleTicket.raffle_id == raffle.id)
        .where(RaffleTicket.ticket_number == ticket_number)
        .with_for_update()
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise ValueError("Bilhete não encontrado.")

    if ticket.status == RaffleTicketStatus.SOLD:
        raise ValueError("Este bilhete já foi vendido.")

    if ticket.status == RaffleTicketStatus.RESERVED:
        if ticket.reserved_until and datetime.now(timezone.utc) > ticket.reserved_until:
            # Expired reservation — allow re-reserve
            pass
        else:
            raise ValueError("Este bilhete está reservado por outro utilizador.")

    now = datetime.now(timezone.utc)
    ticket.status = RaffleTicketStatus.RESERVED
    ticket.reserved_at = now
    ticket.reserved_until = now + timedelta(seconds=RESERVATION_DURATION_SECONDS)
    ticket.reserved_by_id = user.id

    await _set_reservation_redis(str(ticket.id), str(user.id))
    await _log_ticket_history(
        db, raffle.id, ticket.id, ticket.ticket_number, user.id,
        "reserved", from_status="available", to_status="reserved",
    )
    return ticket


# ── Confirm purchase (within reservation window) ──────────────────────────────

async def confirm_purchase(
    raffle: Raffle,
    ticket: RaffleTicket,
    user: User,
    db: AsyncSession,
) -> RaffleTicket:
    """Confirm purchase of a reserved ticket. Debits wallet.
    Auto-re-reserves if the reservation expired."""
    now = datetime.now(timezone.utc)

    # If sold to someone else — block
    if ticket.status == RaffleTicketStatus.SOLD:
        raise ValueError("Este bilhete já foi vendido.")

    # If reserved by another user and still valid — block
    if (
        ticket.status == RaffleTicketStatus.RESERVED
        and str(ticket.reserved_by_id) != str(user.id)
        and ticket.reserved_until
        and now < ticket.reserved_until
    ):
        raise ValueError("Este bilhete está reservado por outro utilizador.")

    # If reserved by us but expired, or not reserved — re-reserve
    if ticket.status != RaffleTicketStatus.RESERVED or (
        ticket.reserved_until and now > ticket.reserved_until
    ):
        ticket.status = RaffleTicketStatus.RESERVED
        ticket.reserved_at = now
        ticket.reserved_until = now + timedelta(seconds=RESERVATION_DURATION_SECONDS)
        ticket.reserved_by_id = user.id
        await _set_reservation_redis(str(ticket.id), str(user.id))

    wallet_result = await db.execute(
        select(Wallet).where(Wallet.user_id == user.id).with_for_update()
    )
    wallet = wallet_result.scalar_one_or_none()
    if not wallet or wallet.available_centavos < raffle.ticket_price_centavos:
        raise ValueError("Saldo insuficiente.")

    # Debit
    wallet.balance_centavos -= raffle.ticket_price_centavos
    tx = Transaction(
        wallet_id=wallet.id,
        idempotency_key=str(uuid.uuid4()),
        type=TransactionType.RAFFLE_ENTRY,
        status=TransactionStatus.COMPLETED,
        amount_centavos=raffle.ticket_price_centavos,
        balance_after_centavos=wallet.balance_centavos,
        description=f"Bilhete #{ticket.ticket_number} — {raffle.title}",
    )
    db.add(tx)

    ticket.status = RaffleTicketStatus.SOLD
    ticket.user_id = user.id
    ticket.purchased_at = datetime.now(timezone.utc)
    ticket.reserved_at = None
    ticket.reserved_until = None
    ticket.reserved_by_id = None
    raffle.tickets_sold += 1
    raffle.pool_held_centavos += raffle.ticket_price_centavos

    await _del_reservation_redis(str(ticket.id))
    await _log_ticket_history(
        db, raffle.id, ticket.id, ticket.ticket_number, user.id,
        "purchased", from_status="reserved", to_status="sold",
    )
    await _notify(
        db, user.id, "raffle_purchased",
        "Bilhete comprado",
        f"Bilhete #{ticket.ticket_number} — {raffle.title}. Boa sorte!",
        {"raffle_id": str(raffle.id), "ticket_id": str(ticket.id), "ticket_number": ticket.ticket_number},
    )
    return ticket


# ── Release reservation ───────────────────────────────────────────────────────

async def release_reservation(
    ticket: RaffleTicket,
    db: AsyncSession,
) -> None:
    """Release a reserved ticket back to available."""
    if ticket.status != RaffleTicketStatus.RESERVED:
        return

    ticket.status = RaffleTicketStatus.AVAILABLE
    ticket.reserved_at = None
    ticket.reserved_until = None
    ticket.reserved_by_id = None

    await _del_reservation_redis(str(ticket.id))
    await _log_ticket_history(
        db, ticket.raffle_id, ticket.id, ticket.ticket_number, None,
        "released", from_status="reserved", to_status="available",
    )


# ── Search available tickets ──────────────────────────────────────────────────

async def search_available_tickets(
    raffle_id: uuid.UUID,
    query: str | None = None,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession | None = None,
) -> list[RaffleTicket]:
    """Search available tickets by number."""
    q = select(RaffleTicket).where(
        RaffleTicket.raffle_id == raffle_id,
        RaffleTicket.status == RaffleTicketStatus.AVAILABLE,
    )
    if query:
        try:
            num = int(query)
            q = q.where(RaffleTicket.ticket_number == num)
        except ValueError:
            return []
    q = q.order_by(RaffleTicket.ticket_number).limit(limit).offset(offset)
    result = await db.execute(q)
    return list(result.scalars().all())


# ── Cancel raffle with refunds ────────────────────────────────────────────────

async def cancel_raffle_with_refunds(
    raffle: Raffle,
    db: AsyncSession,
) -> None:
    """
    Cancel a raffle and refund all sold tickets.
    Releases all reservations and refunds all purchases.
    """
    tickets_result = await db.execute(
        select(RaffleTicket).where(RaffleTicket.raffle_id == raffle.id)
    )
    tickets = tickets_result.scalars().all()

    refunded_count = 0
    for ticket in tickets:
        # Refund sold tickets
        if ticket.status == RaffleTicketStatus.SOLD and ticket.user_id:
            wallet_result = await db.execute(
                select(Wallet).where(Wallet.user_id == ticket.user_id).with_for_update()
            )
            wallet = wallet_result.scalar_one_or_none()
            if wallet:
                wallet.balance_centavos += raffle.ticket_price_centavos
                tx = Transaction(
                    wallet_id=wallet.id,
                    idempotency_key=str(uuid.uuid4()),
                    type=TransactionType.RAFFLE_ENTRY,
                    status=TransactionStatus.REVERSED,
                    amount_centavos=raffle.ticket_price_centavos,
                    balance_after_centavos=wallet.balance_centavos,
                    description=f"Reembolso rifa cancelada: {raffle.title}",
                )
                db.add(tx)
                refunded_count += 1

            await _notify(
                db, ticket.user_id, "raffle_cancelled_refund",
                "Rifa cancelada — reembolso",
                f"A rifa \"{raffle.title}\" foi cancelada. O valor foi reembolsado.",
                {"raffle_id": str(raffle.id), "ticket_number": ticket.ticket_number},
            )

        # Release reservations
        ticket.status = RaffleTicketStatus.AVAILABLE
        ticket.user_id = None
        ticket.purchased_at = None
        ticket.reserved_at = None
        ticket.reserved_until = None
        ticket.reserved_by_id = None
        await _del_reservation_redis(str(ticket.id))

    raffle.tickets_sold = 0
    raffle.pool_held_centavos = 0
    raffle.status = RaffleStatus.CANCELLED

    await _log_ticket_history(
        db, raffle.id, None, 0, None,
        "raffle_cancelled",
        metadata_json=json.dumps({"refunded_count": refunded_count}),
    )


# ── Anonymize participant info ────────────────────────────────────────────────

def anonymize_name(name: str) -> str:
    """Show first letter + asterisks for privacy. Ex: Jo***"""
    if not name:
        return "***"
    if len(name) <= 2:
        return name[0] + "*" * (len(name) - 1)
    return name[:2] + "*" * (len(name) - 2)


async def get_participants(
    raffle_id: uuid.UUID,
    db: AsyncSession,
) -> list[dict]:
    """Get anonymized list of participants."""
    result = await db.execute(
        select(RaffleTicket)
        .where(RaffleTicket.raffle_id == raffle_id, RaffleTicket.status == RaffleTicketStatus.SOLD)
        .order_by(RaffleTicket.ticket_number)
    )
    tickets = result.scalars().all()
    participants: list[dict] = []
    seen: set[str] = set()
    for t in tickets:
        if t.user_id and str(t.user_id) not in seen:
            seen.add(str(t.user_id))
            participants.append({
                "ticket_number": t.ticket_number,
                "name": anonymize_name(t.user.full_name) if t.user else "***",
                "purchased_at": t.purchased_at.isoformat() if t.purchased_at else None,
            })
    return participants
