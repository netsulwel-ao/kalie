"""
Security utilities:
- Password hashing (bcrypt)
- JWT access + refresh tokens
- TOTP (2FA)
- Provably Fair (HMAC-SHA256)
"""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import pyotp
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# ── Password hashing ──────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT ───────────────────────────────────────────────────────────────────────
def create_access_token(subject: str | Any, extra: dict | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {"sub": str(subject), "exp": expire, "type": "access"}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(subject: str | Any) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = {"sub": str(subject), "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    """Raises JWTError if invalid or expired."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


# ── 2FA / TOTP ────────────────────────────────────────────────────────────────
def generate_totp_secret() -> str:
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str) -> str:
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name="Kalie")


def verify_totp(secret: str, code: str) -> bool:
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)


# ── Provably Fair ─────────────────────────────────────────────────────────────
def generate_server_seed() -> str:
    """Generate a cryptographically secure server seed."""
    return secrets.token_hex(32)


def hash_server_seed(server_seed: str) -> str:
    """Return SHA-256 hash of server seed (shown to user before reveal)."""
    return hashlib.sha256(server_seed.encode()).hexdigest()


def generate_client_seed() -> str:
    """Generate a default client seed (user can replace)."""
    return secrets.token_hex(16)


def provably_fair_result(
    server_seed: str,
    client_seed: str,
    nonce: int,
    max_value: int,
) -> int:
    """
    Deterministic result using HMAC-SHA256.
    Returns integer in range [0, max_value).
    Used for games, raffles, and auctions.
    """
    message = f"{client_seed}:{nonce}".encode()
    key = server_seed.encode()
    digest = hmac.new(key, message, hashlib.sha256).hexdigest()
    # Take first 8 hex chars → 32-bit integer
    result = int(digest[:8], 16)
    return result % max_value


# ── Secure token generation ───────────────────────────────────────────────────
def generate_secure_token(length: int = 32) -> str:
    """URL-safe secure random token (for email verification, password reset)."""
    return secrets.token_urlsafe(length)
