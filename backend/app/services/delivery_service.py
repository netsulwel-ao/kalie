"""
Delivery & Escrow service — generates unique delivery codes, handles
confirmation (single/dual), escrow release, dispute lifecycle,
and full audit logging for raffle item delivery.
"""
import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.raffle import DeliveryCode, DeliveryStatus, DeliveryAuditLog, Raffle
from app.models.user import User
from app.models.wallet import Transaction, TransactionStatus, TransactionType, Wallet

DELIVERY_CODE_EXPIRY_DAYS = 30
DELIVERY_CODE_LENGTH = 8


# ── Helpers ────────────────────────────────────────────────────────────────────

def _generate_code() -> str:
    """Generate a unique 8-char alphanumeric delivery code."""
    return secrets.token_urlsafe(6).upper()[:DELIVERY_CODE_LENGTH]


def _build_qr_data(raffle_id: uuid.UUID, code: str) -> str:
    return f"kalie://delivery/{raffle_id}/{code}"


async def _create_audit_log(
    db: AsyncSession,
    delivery_code: DeliveryCode,
    action: str,
    actor_id: uuid.UUID | None = None,
    details: dict | None = None,
) -> None:
    log = DeliveryAuditLog(
        delivery_code_id=delivery_code.id,
        action=action,
        actor_id=actor_id,
        details=details,
    )
    db.add(log)


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


# ── Generate delivery code (called after raffle draw) ─────────────────────────

async def generate_delivery_code(
    raffle: Raffle,
    winner_id: uuid.UUID,
    db: AsyncSession,
    dual_confirmation: bool = False,
) -> DeliveryCode:
    """Generate a unique delivery code for a finished raffle.
    Must be called *instead of* crediting the winner's wallet."""
    now = datetime.now(timezone.utc)

    code = _generate_code()
    # Ensure uniqueness
    existing = await db.execute(select(DeliveryCode).where(DeliveryCode.code == code))
    while existing.scalar_one_or_none():
        code = _generate_code()
        existing = await db.execute(select(DeliveryCode).where(DeliveryCode.code == code))

    qr_data = _build_qr_data(raffle.id, code)
    expires_at = now + timedelta(days=DELIVERY_CODE_EXPIRY_DAYS)

    dc = DeliveryCode(
        raffle_id=raffle.id,
        winner_id=winner_id,
        creator_id=raffle.creator_id,
        code=code,
        qr_data=qr_data,
        status=DeliveryStatus.PENDING,
        escrow_amount_centavos=raffle.pool_held_centavos,
        dual_confirmation=dual_confirmation,
        expires_at=expires_at,
    )
    db.add(dc)
    await db.flush()

    await _create_audit_log(db, dc, "code_generated", actor_id=raffle.creator_id, details={
        "winner_id": str(winner_id),
        "escrow_amount_centavos": raffle.pool_held_centavos,
        "expires_at": expires_at.isoformat(),
    })

    # Notify winner with the code
    await _notify(
        db, winner_id, "raffle_delivery_code",
        "Código de entrega gerado",
        f"O sorteio \"{raffle.title}\" terminou! O teu código de confirmação de entrega é: {code}. "
        f"Disponibiliza este código ao criador após receberes o prémio, ou insere-o na plataforma para confirmares a receção.",
        {"raffle_id": str(raffle.id), "code": code, "qr_data": qr_data},
    )

    # Notify creator that raffle is done
    await _notify(
        db, raffle.creator_id, "raffle_delivery_pending",
        "Entrega pendente",
        f"O sorteio \"{raffle.title}\" já tem vencedor! Aguarda que o vencedor confirme a entrega para receberes o pagamento.",
        {"raffle_id": str(raffle.id)},
    )

    return dc


# ── Confirm delivery (winner enters code) ──────────────────────────────────────

async def confirm_by_code(
    code: str,
    user: User,
    raffle_id: uuid.UUID,
    db: AsyncSession,
) -> DeliveryCode:
    """Winner confirms delivery by entering the delivery code."""
    result = await db.execute(
        select(DeliveryCode).where(
            DeliveryCode.code == code,
            DeliveryCode.raffle_id == raffle_id,
        ).with_for_update()
    )
    dc = result.scalar_one_or_none()
    if not dc:
        raise HTTPException(status_code=404, detail="Código de entrega inválido.")

    if str(dc.winner_id) != str(user.id):
        raise HTTPException(status_code=403, detail="Este código não pertence ao teu utilizador.")

    if dc.status == DeliveryStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Entrega já foi confirmada e concluída.")

    if dc.status == DeliveryStatus.EXPIRED:
        raise HTTPException(status_code=400, detail="Código de entrega expirado. Abre uma disputa.")

    if dc.status == DeliveryStatus.DISPUTED:
        raise HTTPException(status_code=400, detail="Entrega está em disputa.")

    now = datetime.now(timezone.utc)

    if dc.dual_confirmation:
        dc.status = DeliveryStatus.CONFIRMED_BY_WINNER
        dc.confirmed_by_winner_at = now
        await _create_audit_log(db, dc, "confirmed_by_winner", actor_id=user.id)
        # Notify creator that winner confirmed
        await _notify(
            db, dc.creator_id, "raffle_delivery_confirmed_winner",
            "Vencedor confirmou entrega",
            f"O vencedor confirmou a receção do prémio da rifa. Confirma também a entrega para libertares o pagamento.",
            {"raffle_id": str(raffle_id)},
        )
    else:
        # Single confirmation — release immediately
        dc.status = DeliveryStatus.CONFIRMED_BY_WINNER
        dc.confirmed_by_winner_at = now
        await _create_audit_log(db, dc, "confirmed_by_winner", actor_id=user.id)
        await _release_escrow(dc, db)

    return dc


async def confirm_by_creator(
    raffle_id: uuid.UUID,
    user: User,
    db: AsyncSession,
) -> DeliveryCode:
    """Creator confirms delivery (for dual-confirmation mode)."""
    result = await db.execute(
        select(DeliveryCode).where(DeliveryCode.raffle_id == raffle_id).with_for_update()
    )
    dc = result.scalar_one_or_none()
    if not dc:
        raise HTTPException(status_code=404, detail="Nenhum código de entrega encontrado para esta rifa.")

    if str(dc.creator_id) != str(user.id):
        raise HTTPException(status_code=403, detail="Apenas o criador da rifa pode confirmar a entrega.")

    if dc.status == DeliveryStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Entrega já foi concluída.")

    if dc.status == DeliveryStatus.PENDING:
        raise HTTPException(status_code=400, detail="Aguarda que o vencedor confirme primeiro a receção.")

    if dc.status == DeliveryStatus.EXPIRED:
        raise HTTPException(status_code=400, detail="Código de entrega expirado. Abre uma disputa.")

    if dc.status == DeliveryStatus.DISPUTED:
        raise HTTPException(status_code=400, detail="Entrega está em disputa.")

    now = datetime.now(timezone.utc)
    dc.status = DeliveryStatus.CONFIRMED_BY_CREATOR
    dc.confirmed_by_creator_at = now
    await _create_audit_log(db, dc, "confirmed_by_creator", actor_id=user.id)

    # If winner already confirmed, release escrow
    if dc.confirmed_by_winner_at:
        await _release_escrow(dc, db)
    else:
        await _notify(
            db, dc.winner_id, "raffle_delivery_confirmed_creator",
            "Criador confirmou entrega",
            f"O criador da rifa confirmou a entrega. Confirma também a receção para libertares o processo.",
            {"raffle_id": str(raffle_id)},
        )

    return dc


async def confirm_by_code_creator(
    code: str,
    user: User,
    db: AsyncSession,
) -> DeliveryCode:
    """Creator confirms delivery by entering the unique delivery code. Releases escrow immediately."""
    result = await db.execute(
        select(DeliveryCode).where(DeliveryCode.code == code.upper()).with_for_update()
    )
    dc = result.scalar_one_or_none()
    if not dc:
        raise HTTPException(status_code=404, detail="Código de entrega inválido.")

    if str(dc.creator_id) != str(user.id):
        raise HTTPException(status_code=403, detail="Este código não pertence a uma rifa tua.")

    if dc.status == DeliveryStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Entrega já foi concluída.")

    if dc.status == DeliveryStatus.DISPUTED:
        raise HTTPException(status_code=400, detail="Entrega está em disputa.")

    if dc.expires_at and datetime.now(timezone.utc) > dc.expires_at:
        raise HTTPException(status_code=400, detail="Código de entrega expirado.")

    now = datetime.now(timezone.utc)
    dc.status = DeliveryStatus.CONFIRMED_BY_CREATOR
    dc.confirmed_by_creator_at = now
    await _create_audit_log(db, dc, "confirmed_by_code", actor_id=user.id, details={"code": code})

    await _release_escrow(dc, db)

    return dc


# ── Release escrow to creator ──────────────────────────────────────────────────

async def _release_escrow(dc: DeliveryCode, db: AsyncSession) -> None:
    """Release escrowed funds to the creator's wallet."""
    if dc.status == DeliveryStatus.COMPLETED:
        return

    now = datetime.now(timezone.utc)
    raffle_result = await db.execute(
        select(Raffle).where(Raffle.id == dc.raffle_id).with_for_update()
    )
    raffle = raffle_result.scalar_one_or_none()
    if not raffle:
        return

    amount = raffle.pool_held_centavos
    if amount <= 0:
        # Nothing to release — mark as completed anyway
        dc.status = DeliveryStatus.COMPLETED
        dc.completed_at = now
        await _create_audit_log(db, dc, "payment_released", details={"amount_centavos": 0, "note": "nothing held"})
        return

    # Credit creator's wallet
    wallet_result = await db.execute(
        select(Wallet).where(Wallet.user_id == dc.creator_id).with_for_update()
    )
    wallet = wallet_result.scalar_one_or_none()
    if not wallet:
        raise HTTPException(status_code=400, detail="Carteira do criador não encontrada.")

    wallet.balance_centavos += amount
    tx = Transaction(
        wallet_id=wallet.id,
        idempotency_key=str(uuid.uuid4()),
        type=TransactionType.RAFFLE_WIN,
        status=TransactionStatus.COMPLETED,
        amount_centavos=amount,
        balance_after_centavos=wallet.balance_centavos,
        description=f"Pagamento entrega rifa: {raffle.title}",
    )
    db.add(tx)

    # Zero out the pool
    raffle.pool_held_centavos = 0

    dc.status = DeliveryStatus.COMPLETED
    dc.completed_at = now

    await _create_audit_log(db, dc, "escrow_released", details={
        "amount_centavos": amount,
        "creator_id": str(dc.creator_id),
    })

    # Notify creator
    await _notify(
        db, dc.creator_id, "raffle_payment_released",
        "Pagamento libertado!",
        f"O pagamento de {amount/100:.2f} AOA pela rifa \"{raffle.title}\" foi libertado para a tua carteira.",
        {"raffle_id": str(dc.raffle_id), "amount_centavos": amount},
    )


# ── Dispute ────────────────────────────────────────────────────────────────────

async def open_dispute(
    raffle_id: uuid.UUID,
    user: User,
    db: AsyncSession,
    reason: str = "Não recebi o prémio",
) -> DeliveryCode:
    """Open a dispute if delivery wasn't confirmed within the timeframe."""
    result = await db.execute(
        select(DeliveryCode).where(DeliveryCode.raffle_id == raffle_id).with_for_update()
    )
    dc = result.scalar_one_or_none()
    if not dc:
        raise HTTPException(status_code=404, detail="Nenhum código de entrega encontrado para esta rifa.")

    if dc.status == DeliveryStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Entrega já foi concluída.")

    if dc.status == DeliveryStatus.DISPUTED:
        raise HTTPException(status_code=400, detail="Já existe uma disputa aberta para esta entrega.")

    # Only winner or creator can open dispute
    if str(dc.winner_id) != str(user.id) and str(dc.creator_id) != str(user.id):
        raise HTTPException(status_code=403, detail="Apenas o vencedor ou o criador podem abrir uma disputa.")

    now = datetime.now(timezone.utc)
    dc.status = DeliveryStatus.DISPUTED
    dc.dispute_reason = reason
    dc.dispute_opened_at = now

    await _create_audit_log(db, dc, "dispute_opened", actor_id=user.id, details={"reason": reason})

    # Notify both parties
    await _notify(
        db, dc.winner_id, "raffle_dispute_opened",
        "Disputa aberta",
        f"Foi aberta uma disputa para a rifa. Motivo: {reason}",
        {"raffle_id": str(dc.raffle_id)},
    )
    await _notify(
        db, dc.creator_id, "raffle_dispute_opened",
        "Disputa aberta",
        f"Foi aberta uma disputa para a rifa. Motivo: {reason}",
        {"raffle_id": str(dc.raffle_id)},
    )

    return dc


async def resolve_dispute(
    delivery_code_id: uuid.UUID,
    resolution: str,
    release_to_creator: bool,
    db: AsyncSession,
) -> DeliveryCode:
    """Resolve a dispute (admin function)."""
    result = await db.execute(
        select(DeliveryCode).where(DeliveryCode.id == delivery_code_id).with_for_update()
    )
    dc = result.scalar_one_or_none()
    if not dc:
        raise HTTPException(status_code=404, detail="Código de entrega não encontrado.")

    if dc.status != DeliveryStatus.DISPUTED:
        raise HTTPException(status_code=400, detail="Esta entrega não está em disputa.")

    now = datetime.now(timezone.utc)
    dc.dispute_resolved_at = now
    dc.dispute_resolution = resolution

    if release_to_creator:
        await _create_audit_log(db, dc, "dispute_resolved_release_creator", details={"resolution": resolution})
        await _release_escrow(dc, db)
    else:
        # Refund to winner — pool stays with platform for manual processing
        dc.status = DeliveryStatus.COMPLETED
        dc.completed_at = now
        await _create_audit_log(db, dc, "dispute_resolved_refund_winner", details={"resolution": resolution})
        await _notify(
            db, dc.winner_id, "raffle_dispute_resolved",
            "Disputa resolvida",
            f"A disputa foi resolvida: {resolution}",
            {"raffle_id": str(dc.raffle_id)},
        )
        await _notify(
            db, dc.creator_id, "raffle_dispute_resolved",
            "Disputa resolvida",
            f"A disputa foi resolvida: {resolution}",
            {"raffle_id": str(dc.raffle_id)},
        )

    return dc


# ── Status ─────────────────────────────────────────────────────────────────────

async def get_delivery_status(
    raffle_id: uuid.UUID,
    db: AsyncSession,
) -> DeliveryCode | None:
    """Get the current delivery code and status for a raffle."""
    result = await db.execute(
        select(DeliveryCode).where(DeliveryCode.raffle_id == raffle_id)
    )
    return result.scalar_one_or_none()
