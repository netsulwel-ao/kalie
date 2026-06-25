"""
Wallet endpoints — balance, transactions, deposit, withdraw, transfer.
"""
import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.models.wallet import Transaction, TransactionStatus, TransactionType, Wallet

router = APIRouter(prefix="/wallet", tags=["wallet"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class WalletOut(BaseModel):
    id: str
    balance_centavos: int
    locked_centavos: int
    available_centavos: int
    balance_aoa: float

    model_config = {"from_attributes": True}


class TransactionOut(BaseModel):
    id: str
    type: str
    status: str
    amount_centavos: int
    balance_after_centavos: int
    description: str | None
    external_ref: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DepositRequest(BaseModel):
    amount_centavos: int = Field(..., gt=0, description="Valor em centavos (1 AOA = 100 centavos)")
    external_ref: str | None = None
    description: str | None = None


class WithdrawRequest(BaseModel):
    amount_centavos: int = Field(..., gt=0)
    description: str | None = None


class TransferRequest(BaseModel):
    to_user_id: str
    amount_centavos: int = Field(..., gt=0)
    description: str | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sign_transaction(tx: Transaction) -> str:
    """HMAC-SHA256 signature for audit log integrity."""
    payload = json.dumps({
        "id": str(tx.id),
        "wallet_id": str(tx.wallet_id),
        "type": tx.type,
        "amount": tx.amount_centavos,
        "balance_after": tx.balance_after_centavos,
        "created_at": tx.created_at.isoformat() if tx.created_at else "",
    }, sort_keys=True)
    return hmac.new(settings.SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()


async def _get_wallet(user_id: uuid.UUID, db: AsyncSession) -> Wallet:
    result = await db.execute(select(Wallet).where(Wallet.user_id == user_id))
    wallet = result.scalar_one_or_none()
    if not wallet:
        wallet = Wallet(user_id=user_id, balance_centavos=0, locked_centavos=0)
        db.add(wallet)
        await db.flush()
    return wallet


async def _get_wallet_for_update(user_id: uuid.UUID, db: AsyncSession) -> Wallet:
    """Fetch wallet with row-level lock (SELECT FOR UPDATE) for safe concurrent writes."""
    result = await db.execute(
        select(Wallet).where(Wallet.user_id == user_id).with_for_update()
    )
    wallet = result.scalar_one_or_none()
    if not wallet:
        wallet = Wallet(user_id=user_id, balance_centavos=0, locked_centavos=0)
        db.add(wallet)
        await db.flush()
    return wallet


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=WalletOut)
async def get_wallet(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    wallet = await _get_wallet(current_user.id, db)
    await db.commit()
    return WalletOut(
        id=str(wallet.id),
        balance_centavos=wallet.balance_centavos,
        locked_centavos=wallet.locked_centavos,
        available_centavos=wallet.available_centavos,
        balance_aoa=float(wallet.balance_aoa),
    )


@router.get("/transactions", response_model=list[TransactionOut])
async def get_transactions(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    wallet = await _get_wallet(current_user.id, db)
    await db.commit()
    result = await db.execute(
        select(Transaction)
        .where(Transaction.wallet_id == wallet.id)
        .order_by(Transaction.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    txs = result.scalars().all()
    return [TransactionOut(
        id=str(t.id),
        type=t.type,
        status=t.status,
        amount_centavos=t.amount_centavos,
        balance_after_centavos=t.balance_after_centavos,
        description=t.description,
        external_ref=t.external_ref,
        created_at=t.created_at,
    ) for t in txs]


@router.post("/deposit", response_model=WalletOut)
async def deposit(
    body: DepositRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    wallet = await _get_wallet_for_update(current_user.id, db)
    wallet.balance_centavos += body.amount_centavos

    tx = Transaction(
        wallet_id=wallet.id,
        idempotency_key=str(uuid.uuid4()),
        type=TransactionType.DEPOSIT,
        status=TransactionStatus.COMPLETED,
        amount_centavos=body.amount_centavos,
        balance_after_centavos=wallet.balance_centavos,
        description=body.description or "Depósito",
        external_ref=body.external_ref,
        created_at=datetime.now(timezone.utc),
    )
    db.add(tx)
    await db.flush()
    tx.hmac_signature = _sign_transaction(tx)
    await db.commit()
    await db.refresh(wallet)

    return WalletOut(
        id=str(wallet.id),
        balance_centavos=wallet.balance_centavos,
        locked_centavos=wallet.locked_centavos,
        available_centavos=wallet.available_centavos,
        balance_aoa=float(wallet.balance_aoa),
    )


@router.post("/withdraw", response_model=WalletOut)
async def withdraw(
    body: WithdrawRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Lock row to prevent race conditions on balance check
    wallet = await _get_wallet_for_update(current_user.id, db)
    if wallet.available_centavos < body.amount_centavos:
        raise HTTPException(status_code=400, detail="Saldo insuficiente.")

    wallet.balance_centavos -= body.amount_centavos

    tx = Transaction(
        wallet_id=wallet.id,
        idempotency_key=str(uuid.uuid4()),
        type=TransactionType.WITHDRAWAL,
        status=TransactionStatus.COMPLETED,
        amount_centavos=body.amount_centavos,
        balance_after_centavos=wallet.balance_centavos,
        description=body.description or "Levantamento",
        created_at=datetime.now(timezone.utc),
    )
    db.add(tx)
    await db.flush()
    tx.hmac_signature = _sign_transaction(tx)
    await db.commit()
    await db.refresh(wallet)

    return WalletOut(
        id=str(wallet.id),
        balance_centavos=wallet.balance_centavos,
        locked_centavos=wallet.locked_centavos,
        available_centavos=wallet.available_centavos,
        balance_aoa=float(wallet.balance_aoa),
    )


@router.post("/transfer", response_model=WalletOut)
async def transfer(
    body: TransferRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if str(current_user.id) == body.to_user_id:
        raise HTTPException(status_code=400, detail="Não podes transferir para ti mesmo.")

    # Lock sender wallet to prevent race conditions
    sender_wallet = await _get_wallet_for_update(current_user.id, db)
    if sender_wallet.available_centavos < body.amount_centavos:
        raise HTTPException(status_code=400, detail="Saldo insuficiente.")

    result = await db.execute(select(User).where(User.id == uuid.UUID(body.to_user_id)))
    recipient = result.scalar_one_or_none()
    if not recipient:
        raise HTTPException(status_code=404, detail="Utilizador destinatário não encontrado.")

    recipient_wallet = await _get_wallet(recipient.id, db)

    sender_wallet.balance_centavos -= body.amount_centavos
    recipient_wallet.balance_centavos += body.amount_centavos

    now = datetime.now(timezone.utc)
    tx_out = Transaction(
        wallet_id=sender_wallet.id,
        idempotency_key=str(uuid.uuid4()),
        type=TransactionType.TRANSFER_OUT,
        status=TransactionStatus.COMPLETED,
        amount_centavos=body.amount_centavos,
        balance_after_centavos=sender_wallet.balance_centavos,
        description=body.description or f"Transferência para {recipient.full_name}",
        created_at=now,
    )
    tx_in = Transaction(
        wallet_id=recipient_wallet.id,
        idempotency_key=str(uuid.uuid4()),
        type=TransactionType.TRANSFER_IN,
        status=TransactionStatus.COMPLETED,
        amount_centavos=body.amount_centavos,
        balance_after_centavos=recipient_wallet.balance_centavos,
        description=body.description or f"Transferência de {current_user.full_name}",
        created_at=now,
    )
    db.add(tx_out)
    db.add(tx_in)
    await db.flush()
    tx_out.hmac_signature = _sign_transaction(tx_out)
    tx_in.hmac_signature = _sign_transaction(tx_in)
    await db.commit()
    await db.refresh(sender_wallet)

    return WalletOut(
        id=str(sender_wallet.id),
        balance_centavos=sender_wallet.balance_centavos,
        locked_centavos=sender_wallet.locked_centavos,
        available_centavos=sender_wallet.available_centavos,
        balance_aoa=float(sender_wallet.balance_aoa),
    )
