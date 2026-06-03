"""
Redis client — used for:
- Session storage
- Rate limiting counters
- Brute force protection
- Cache
- OTP / email verification tokens
"""
from typing import Any

import redis.asyncio as aioredis

from app.core.config import settings

_redis_client: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20,
        )
    return _redis_client


# ── Brute force protection ────────────────────────────────────────────────────
BRUTE_FORCE_MAX_ATTEMPTS = 5
BRUTE_FORCE_WINDOW_SECONDS = 300  # 5 minutes
BRUTE_FORCE_LOCKOUT_SECONDS = 900  # 15 minutes


async def check_brute_force(identifier: str) -> bool:
    """Returns True if the identifier is locked out."""
    redis = await get_redis()
    lockout_key = f"lockout:{identifier}"
    return await redis.exists(lockout_key) == 1


async def record_failed_attempt(identifier: str) -> int:
    """
    Records a failed login attempt.
    Returns current attempt count.
    Locks out after BRUTE_FORCE_MAX_ATTEMPTS.
    """
    redis = await get_redis()
    attempt_key = f"attempts:{identifier}"
    lockout_key = f"lockout:{identifier}"

    count = await redis.incr(attempt_key)
    await redis.expire(attempt_key, BRUTE_FORCE_WINDOW_SECONDS)

    if count >= BRUTE_FORCE_MAX_ATTEMPTS:
        await redis.setex(lockout_key, BRUTE_FORCE_LOCKOUT_SECONDS, "1")
        await redis.delete(attempt_key)

    return count


async def clear_failed_attempts(identifier: str) -> None:
    """Clear attempts after successful login."""
    redis = await get_redis()
    await redis.delete(f"attempts:{identifier}")
    await redis.delete(f"lockout:{identifier}")


# ── Token blacklist (logout / refresh revocation) ────────────────────────────
async def blacklist_token(jti: str, expire_seconds: int) -> None:
    redis = await get_redis()
    await redis.setex(f"blacklist:{jti}", expire_seconds, "1")


async def is_token_blacklisted(jti: str) -> bool:
    redis = await get_redis()
    return await redis.exists(f"blacklist:{jti}") == 1


# ── Email verification / password reset tokens ───────────────────────────────
async def store_verification_token(
    token: str, user_id: str, purpose: str, expire_seconds: int = 3600
) -> None:
    redis = await get_redis()
    await redis.setex(f"verify:{purpose}:{token}", expire_seconds, user_id)


async def consume_verification_token(token: str, purpose: str) -> str | None:
    """Returns user_id if valid, None otherwise. Deletes token on use."""
    redis = await get_redis()
    key = f"verify:{purpose}:{token}"
    user_id = await redis.get(key)
    if user_id:
        await redis.delete(key)
    return user_id


# ── Cache helpers ─────────────────────────────────────────────────────────────
async def cache_set(key: str, value: Any, expire_seconds: int = 300) -> None:
    redis = await get_redis()
    await redis.setex(key, expire_seconds, str(value))


async def cache_get(key: str) -> str | None:
    redis = await get_redis()
    return await redis.get(key)


async def cache_delete(key: str) -> None:
    redis = await get_redis()
    await redis.delete(key)
