"""
Auction service — place_bid with anti-sniping, escrow, delivery, audit.
"""
import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction import Auction, AuctionAuditLog, AuctionDeliveryStatus, AuctionStatus, Bid
from app.models.notification import Notification
from app.models.user import User
from app.models.wallet import Transaction, TransactionStatus, TransactionType, Wallet

DELIVERY_CODE_LENGTH = 8

AUCTION_REFUND_DELAY_MINUTES = 1


def _generate_code() -> str:
    """Generate a unique 8-char alphanumeric delivery code."""
    return secrets.token_urlsafe(6).upper()[:DELIVERY_CODE_LENGTH]


async def _create_audit_log(
    db: AsyncSession, auction_id: uuid.UUID, action: str,
    actor_id: uuid.UUID | None = None, details: dict | None = None,
) -> None:
    log = AuctionAuditLog(
        auction_id=auction_id, action=action, actor_id=actor_id,
        details=json.dumps(details) if details else None,
    )
    db.add(log)


async def _notify(
    db: AsyncSession, user_id: uuid.UUID, ntype: str, title: str, body: str,
    data: dict | None = None,
) -> None:
    db.add(Notification(
        user_id=user_id, type=ntype, title=title, body=body,
        data=json.dumps(data) if data else None,
    ))


async def _get_wallet(user_id: uuid.UUID, db: AsyncSession) -> Wallet:
    result = await db.execute(select(Wallet).where(Wallet.user_id == user_id).with_for_update())
    wallet = result.scalar_one_or_none()
    if not wallet:
        raise HTTPException(status_code=400, detail="Carteira não encontrada.")
    return wallet


def _anonymize(name: str) -> str:
    if not name or len(name) < 2:
        return "***"
    return f"{name[:2]}***"


async def place_bid(
    auction_id: uuid.UUID, amount_centavos: int, user: User, db: AsyncSession,
) -> Bid:
    """Place a bid with anti-sniping protection."""
    result = await db.execute(
        select(Auction).where(Auction.id == auction_id).with_for_update()
    )
    auction = result.scalar_one_or_none()
    if not auction:
        raise HTTPException(status_code=404, detail="Leilão não encontrado.")
    if auction.status != AuctionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Leilão já não está activo.")
    if str(auction.creator_id) == str(user.id):
        raise HTTPException(status_code=400, detail="Não podes licitar no teu próprio leilão.")

    now = datetime.now(timezone.utc)
    if now < auction.starts_at:
        raise HTTPException(status_code=400, detail="Leilão ainda não começou.")
    effective_end = auction.ends_at_extended or auction.ends_at
    if now > effective_end:
        raise HTTPException(status_code=400, detail="Leilão já terminou.")

    if auction.current_bid_centavos == 0:
        min_bid = auction.reserve_price_centavos
    else:
        min_bid = auction.current_bid_centavos + auction.min_increment_centavos
    if amount_centavos < min_bid:
        raise HTTPException(status_code=400, detail=f"Lance mínimo: {format(min_bid, ',d')} centavos.")

    wallet = await _get_wallet(user.id, db)
    available = wallet.balance_centavos - wallet.locked_centavos

    # Check if user already has bids in this auction (already paid caution)
    latest_bid_row = await db.execute(
        select(Bid).where(Bid.auction_id == auction.id, Bid.user_id == user.id)
        .order_by(Bid.created_at.desc()).limit(1)
    )
    latest_bid = latest_bid_row.scalar_one_or_none()

    if latest_bid:
        increment = amount_centavos - latest_bid.amount_centavos
        if available < increment:
            raise HTTPException(status_code=400, detail="Saldo disponível insuficiente.")
        if latest_bid.is_active:
            latest_bid.is_active = False
            latest_bid.is_winning = False
            latest_bid.refunded = True
        wallet.locked_centavos += increment
    else:
        total = auction.starting_bid_centavos + amount_centavos
        if available < total:
            raise HTTPException(status_code=400, detail="Saldo disponível insuficiente para caução + lance.")
        wallet.locked_centavos += total

    # Refund previous winning bid (different user)
    prev_result = await db.execute(
        select(Bid).where(Bid.auction_id == auction.id, Bid.is_winning == True)
    )
    prev_winning = prev_result.scalar_one_or_none()
    if prev_winning and str(prev_winning.user_id) != str(user.id):
        prev_winning.is_winning = False
        prev_winning.is_active = False
        prev_wallet = await _get_wallet(prev_winning.user_id, db)
        prev_wallet.locked_centavos = max(0, prev_wallet.locked_centavos - prev_winning.amount_centavos)
        prev_winning.refunded = True
        db.add(Transaction(
            wallet_id=prev_wallet.id, idempotency_key=str(uuid.uuid4()),
            type=TransactionType.AUCTION_REFUND,
            status=TransactionStatus.COMPLETED,
            amount_centavos=prev_winning.amount_centavos,
            balance_after_centavos=prev_wallet.balance_centavos,
            description=f"Reembolso lance ultrapassado: {auction.title}",
        ))
        await _create_audit_log(db, auction.id, "bid_outbidded",
            actor_id=prev_winning.user_id,
            details={"amount_centavos": prev_winning.amount_centavos, "replaced_by": str(user.id)},
        )
        await _notify(db, prev_winning.user_id, "auction_outbidded",
            "Foste ultrapassado!",
            f"A tua oferta de {prev_winning.amount_centavos/100:.0f} AOA no leilão \"{auction.title}\" foi ultrapassada.",
            {"auction_id": str(auction.id)},
        )

    bid = Bid(
        auction_id=auction.id, user_id=user.id,
        amount_centavos=amount_centavos, is_winning=True, is_active=True,
    )
    auction.pool_held_centavos = amount_centavos
    auction.current_bid_centavos = amount_centavos
    db.add(bid)

    # Anti-sniping: window = 60s, extension = 120s
    SNIPING_WINDOW = 60
    SNIPING_EXTENSION = 120
    window_start = effective_end - timedelta(seconds=SNIPING_WINDOW)
    if now >= window_start and auction.extensions_count < auction.max_extensions:
        new_end = now + timedelta(seconds=SNIPING_EXTENSION)
        auction.ends_at_extended = new_end
        auction.extensions_count += 1
        new_effective = new_end
        await _create_audit_log(db, auction.id, "anti_sniping_extension",
            details={
                "previous_end": effective_end.isoformat(),
                "new_end": new_end.isoformat(),
                "extension_number": auction.extensions_count,
            },
        )
        msg = f"O leilão \"{auction.title}\" foi prolongado até às {new_end.strftime('%H:%M')} devido a uma oferta nos últimos segundos."
        for bidder in await db.execute(
            select(Bid.user_id).where(Bid.auction_id == auction.id, Bid.is_active == True).distinct()
        ):
            await _notify(db, bidder[0], "auction_extended", "Leilão prolongado!", msg, {"auction_id": str(auction.id)})
    else:
        new_effective = effective_end

    await _create_audit_log(db, auction.id, "bid_placed",
        actor_id=user.id,
        details={"amount_centavos": amount_centavos, "is_leading": True},
    )

    await _notify(db, user.id, "auction_leading",
        "És o líder!",
        f"A tua oferta de {amount_centavos/100:.0f} AOA é a mais alta no leilão \"{auction.title}\".",
        {"auction_id": str(auction.id)},
    )

    await db.flush()
    return bid


async def finalize_auction(auction_id: uuid.UUID, db: AsyncSession) -> Auction:
    """Finalize auction, determine winner, generate delivery code."""
    result = await db.execute(
        select(Auction).where(Auction.id == auction_id).with_for_update()
    )
    auction = result.scalar_one_or_none()
    if not auction:
        raise HTTPException(status_code=404, detail="Leilão não encontrado.")
    if auction.status != AuctionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Leilão já finalizado.")

    now = datetime.now(timezone.utc)

    bid_result = await db.execute(
        select(Bid).where(Bid.auction_id == auction.id, Bid.is_winning == True)
    )
    winning = bid_result.scalar_one_or_none()

    if winning:
        auction.status = AuctionStatus.FINISHED
        auction.winner_id = winning.user_id
        winner_wallet = await _get_wallet(winning.user_id, db)

        # Winner: caution returned; winning bid stays locked until delivery
        winner_wallet.locked_centavos = max(0, winner_wallet.locked_centavos - auction.starting_bid_centavos)

        # Return caution to all losers and unlock their bids
        all_losers = await db.execute(
            select(Bid.user_id).where(
                Bid.auction_id == auction.id,
                Bid.user_id != winning.user_id,
            ).distinct()
        )
        for (loser_id,) in all_losers:
            loser_wallet = await _get_wallet(loser_id, db)
            loser_wallet.locked_centavos = max(0, loser_wallet.locked_centavos - auction.starting_bid_centavos)

            # Return any active bids still locked
            loser_active = await db.execute(
                select(func.sum(Bid.amount_centavos)).where(
                    Bid.auction_id == auction.id, Bid.user_id == loser_id,
                    Bid.is_active == True,
                )
            )
            extra = loser_active.scalar() or 0
            if extra:
                loser_wallet.locked_centavos = max(0, loser_wallet.locked_centavos - extra)

            await _notify(db, loser_id, "auction_lost",
                "Leilão encerrado",
                f"O leilão \"{auction.title}\" terminou. A tua caução foi devolvida.",
                {"auction_id": str(auction.id)},
            )

        auction.pool_held_centavos = winning.amount_centavos

        # Generate delivery code (escrow remains in pool_held_centavos)
        code = _generate_code()
        auction.delivery_code = code
        auction.delivery_status = AuctionDeliveryStatus.PENDING

        await _notify(db, winning.user_id, "auction_won",
            "🎉 Ganhaste o leilão!",
            f"Ganhaste o leilão \"{auction.title}\" com {winning.amount_centavos/100:.0f} AOA. Verifica o código de entrega.",
            {"auction_id": str(auction.id), "code": code},
        )
        await _notify(db, auction.creator_id, "auction_finished",
            "Leilão encerrado!",
            f"O leilão \"{auction.title}\" foi encerrado. O vencedor foi notificado com o código de entrega.",
            {"auction_id": str(auction.id)},
        )
    else:
        # No bids — cancel
        auction.status = AuctionStatus.FINISHED
        auction.pool_held_centavos = 0
        await _notify(db, auction.creator_id, "auction_finished",
            "Leilão encerrado sem ofertas",
            f"O leilão \"{auction.title}\" foi encerrado sem ofertas.",
            {"auction_id": str(auction.id)},
        )

    await _create_audit_log(db, auction.id, "auction_ended", details={
        "winner_id": str(winning.user_id) if winning else None,
        "final_amount_centavos": winning.amount_centavos if winning else 0,
    })

    await db.flush()
    return auction


async def auto_finalize_expired(db: AsyncSession) -> int:
    """Finalize any active auctions past their end time. Returns count finalized."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Auction).where(
            Auction.status == AuctionStatus.ACTIVE,
            func.coalesce(Auction.ends_at_extended, Auction.ends_at) < now,
        ).with_for_update(skip_locked=True)
    )
    expired = result.scalars().all()
    count = 0
    for auction in expired:
        try:
            await finalize_auction(auction.id, db)
            count += 1
        except Exception:
            continue
    if count:
        await db.flush()
    return count


async def get_auction_detail(
    auction_id: uuid.UUID, user: User | None, db: AsyncSession,
) -> dict:
    """Return auction detail with the user's position."""
    result = await db.execute(select(Auction).where(Auction.id == auction_id))
    auction = result.scalar_one_or_none()
    if not auction:
        raise HTTPException(status_code=404, detail="Leilão não encontrado.")

    # Count participants (distinct bidders with active bids)
    participant_count_result = await db.execute(
        select(func.count(func.distinct(Bid.user_id)))
        .where(Bid.auction_id == auction.id, Bid.is_active == True)
    )
    total_participants = participant_count_result.scalar() or 0

    # Count total bids
    total_bids_result = await db.execute(
        select(func.count(Bid.id)).where(Bid.auction_id == auction.id)
    )
    total_bids = total_bids_result.scalar() or 0

    result_data = {
        "id": str(auction.id),
        "creator_id": str(auction.creator_id),
        "title": auction.title,
        "description": auction.description,
        "image_url": auction.image_url,
        "starting_bid_centavos": auction.starting_bid_centavos,
        "reserve_price_centavos": auction.reserve_price_centavos,
        "current_bid_centavos": auction.current_bid_centavos,
        "min_increment_centavos": auction.min_increment_centavos,
        "min_next_bid": auction.reserve_price_centavos if auction.current_bid_centavos == 0 else auction.current_bid_centavos + auction.min_increment_centavos,
        "pool_held_centavos": auction.pool_held_centavos,
        "status": auction.status,
        "winner_id": str(auction.winner_id) if auction.winner_id else None,
        "starts_at": auction.starts_at,
        "ends_at": auction.ends_at,
        "ends_at_extended": auction.ends_at_extended,
        "anti_sniping_window_seconds": auction.anti_sniping_window_seconds,
        "extensions_count": auction.extensions_count,
        "max_extensions": auction.max_extensions,
        "total_bids": total_bids,
        "total_participants": total_participants,
        "created_at": auction.created_at,
        "delivery_status": auction.delivery_status,
        "delivery_confirmed_at": auction.delivery_confirmed_at,
        "has_delivery_code": auction.delivery_code is not None,
        "delivery_code": None,
    }

    # User position
    if user:
        user_bid = await db.execute(
            select(Bid).where(
                Bid.auction_id == auction.id, Bid.user_id == user.id,
                Bid.is_active == True,
            ).order_by(Bid.created_at.desc()).limit(1)
        )
        ub = user_bid.scalar_one_or_none()
        if ub:
            result_data["user_position"] = "leading" if ub.is_winning else "outbidded"
            result_data["user_bid_amount"] = ub.amount_centavos
        else:
            result_data["user_position"] = "not_participating"
            result_data["user_bid_amount"] = None

        # Show delivery code to the winner
        if auction.winner_id and str(auction.winner_id) == str(user.id):
            result_data["delivery_code"] = auction.delivery_code
    else:
        result_data["user_position"] = None
        result_data["user_bid_amount"] = None

    return result_data


async def get_bid_history(
    auction_id: uuid.UUID, user: User | None, db: AsyncSession,
) -> list[dict]:
    """Return anonymized bid history."""
    result = await db.execute(
        select(Bid).where(Bid.auction_id == auction_id)
        .order_by(Bid.created_at.desc())
    )
    bids = result.scalars().all()

    is_creator = user and str(
        (await db.execute(select(Auction.creator_id).where(Auction.id == auction_id))).scalar_one_or_none()
    ) == str(user.id)

    history = []
    bidder_counter = 1
    bidder_map: dict[str, int] = {}

    for b in bids:
        uid = str(b.user_id)
        if uid not in bidder_map:
            bidder_map[uid] = bidder_counter
            bidder_counter += 1

        if user and str(user.id) == uid:
            label = "Tu"
        elif is_creator:
            label = f"Participante #{bidder_map[uid]}"
        else:
            label = f"Participante #{bidder_map[uid]}"

        history.append({
            "amount_centavos": b.amount_centavos,
            "bidder_label": label,
            "is_winning": b.is_winning,
            "is_active": b.is_active,
            "created_at": b.created_at,
        })

    return history


async def get_participants(
    auction_id: uuid.UUID, user: User, db: AsyncSession,
) -> list[dict]:
    """Return anonymized participant list (creator only)."""
    auction_result = await db.execute(select(Auction).where(Auction.id == auction_id))
    auction = auction_result.scalar_one_or_none()
    if not auction:
        raise HTTPException(status_code=404, detail="Leilão não encontrado.")
    if str(auction.creator_id) != str(user.id):
        raise HTTPException(status_code=403, detail="Apenas o criador pode ver participantes.")

    result = await db.execute(
        select(Bid.user_id, func.sum(Bid.amount_centavos).label("total_locked"), func.count(Bid.id).label("bid_count"))
        .where(Bid.auction_id == auction.id, Bid.is_active == True)
        .group_by(Bid.user_id)
    )
    rows = result.all()

    participants = []
    counter = 1
    for row in rows:
        u = await db.get(User, row.user_id)
        name = _anonymize(u.full_name) if u else "***"
        participants.append({
            "label": f"Participante #{counter}",
            "name": name,
            "total_locked_centavos": row.total_locked,
            "bid_count": row.bid_count,
        })
        counter += 1

    return participants


async def confirm_delivery_by_code(
    code: str, creator: User, db: AsyncSession,
) -> dict:
    """Creator confirms auction delivery by code — releases escrow to creator."""
    result = await db.execute(
        select(Auction).where(Auction.delivery_code == code.upper()).with_for_update()
    )
    auction = result.scalar_one_or_none()
    if not auction:
        raise HTTPException(status_code=404, detail="Código de entrega inválido.")
    if str(auction.creator_id) != str(creator.id):
        raise HTTPException(status_code=403, detail="Este código não pertence a um leilão teu.")
    if auction.delivery_status == AuctionDeliveryStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Entrega já foi concluída.")
    if not auction.winner_id:
        raise HTTPException(status_code=400, detail="Leilão não tem vencedor.")

    amount = auction.pool_held_centavos
    if amount <= 0:
        auction.delivery_status = AuctionDeliveryStatus.COMPLETED
        auction.delivery_confirmed_at = datetime.now(timezone.utc)
        await _create_audit_log(db, auction.id, "delivery_released", details={
            "amount_centavos": 0, "note": "nothing held",
        })
        await db.flush()
        return {"message": "Entrega confirmada.", "amount_centavos": 0}

    # Debit winner wallet (actual payment at delivery)
    winner_wallet_result = await db.execute(
        select(Wallet).where(Wallet.user_id == auction.winner_id).with_for_update()
    )
    winner_wallet = winner_wallet_result.scalar_one_or_none()
    if not winner_wallet:
        raise HTTPException(status_code=400, detail="Carteira do vencedor não encontrada.")

    now = datetime.now(timezone.utc)
    winner_wallet.balance_centavos -= amount
    winner_wallet.locked_centavos = max(0, winner_wallet.locked_centavos - amount)
    db.add(Transaction(
        wallet_id=winner_wallet.id,
        idempotency_key=f"delivery_{auction.id}",
        type=TransactionType.AUCTION_BID,
        status=TransactionStatus.COMPLETED,
        amount_centavos=amount,
        balance_after_centavos=winner_wallet.balance_centavos,
        description=f"Leilão ganho: {auction.title}",
    ))

    # Credit creator wallet
    wallet_result = await db.execute(
        select(Wallet).where(Wallet.user_id == auction.creator_id).with_for_update()
    )
    wallet = wallet_result.scalar_one_or_none()
    if not wallet:
        raise HTTPException(status_code=400, detail="Carteira do criador não encontrada.")

    wallet.balance_centavos += amount
    db.add(Transaction(
        wallet_id=wallet.id,
        idempotency_key=str(uuid.uuid4()),
        type=TransactionType.TRANSFER_IN,
        status=TransactionStatus.COMPLETED,
        amount_centavos=amount,
        balance_after_centavos=wallet.balance_centavos,
        description=f"Pagamento entrega leilão: {auction.title}",
    ))

    auction.pool_held_centavos = 0
    auction.delivery_status = AuctionDeliveryStatus.COMPLETED
    auction.delivery_confirmed_at = now

    await _create_audit_log(db, auction.id, "delivery_released", details={
        "amount_centavos": amount, "creator_id": str(auction.creator_id),
    })

    await _notify(db, auction.creator_id, "auction_payment_released",
        "Pagamento libertado!",
        f"O pagamento de {amount/100:.2f} AOA do leilão \"{auction.title}\" foi libertado para a tua carteira.",
        {"auction_id": str(auction.id), "amount_centavos": amount},
    )
    await _notify(db, auction.winner_id, "auction_delivery_confirmed",
        "Entrega confirmada!",
        f"A entrega do leilão \"{auction.title}\" foi confirmada pelo criador.",
        {"auction_id": str(auction.id)},
    )

    await db.flush()
    return {"message": "Entrega confirmada com sucesso!", "amount_centavos": amount}


async def delivery_lookup_by_code(code: str, user: User, db: AsyncSession) -> dict:
    """Look up auction by delivery code (returns basic info + winner anonymized)."""
    result = await db.execute(
        select(Auction).where(Auction.delivery_code == code.upper())
    )
    auction = result.scalar_one_or_none()
    if not auction:
        raise HTTPException(status_code=404, detail="Código de entrega inválido.")
    if str(auction.creator_id) != str(user.id):
        raise HTTPException(status_code=403, detail="Este código não pertence a um leilão teu.")
    if auction.status != AuctionStatus.FINISHED:
        raise HTTPException(status_code=400, detail="Leilão ainda não terminou.")

    winner_name = "***"
    if auction.winner_id:
        winner = await db.get(User, auction.winner_id)
        if winner:
            winner_name = _anonymize(winner.full_name)

    return {
        "id": str(auction.id),
        "title": auction.title,
        "image_url": auction.image_url,
        "pool_held_centavos": auction.pool_held_centavos,
        "delivery_status": auction.delivery_status,
        "winner_name": winner_name,
    }


async def auto_refund_outbidded(db: AsyncSession) -> int:
    """Auto-refund outbidded bids that haven't been refunded yet (edge cases)."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=AUCTION_REFUND_DELAY_MINUTES)
    result = await db.execute(
        select(Bid).where(
            Bid.is_active == False,
            Bid.is_winning == False,
            Bid.refunded == False,
            Bid.created_at < cutoff,
        )
    )
    bids = result.scalars().all()
    count = 0
    for bid in bids:
        wallet = await _get_wallet(bid.user_id, db)
        wallet.locked_centavos = max(0, wallet.locked_centavos - bid.amount_centavos)
        bid.refunded = True
        db.add(Transaction(
            wallet_id=wallet.id, idempotency_key=str(uuid.uuid4()),
            type=TransactionType.AUCTION_REFUND,
            status=TransactionStatus.COMPLETED,
            amount_centavos=bid.amount_centavos,
            balance_after_centavos=wallet.balance_centavos,
            description=f"Reembolso automático lance ultrapassado: leilão {str(bid.auction_id)[:8]}",
        ))
        await _create_audit_log(db, bid.auction_id, "auto_refund",
            actor_id=bid.user_id,
            details={"amount_centavos": bid.amount_centavos},
        )
        count += 1
    if count:
        await db.flush()
    return count
