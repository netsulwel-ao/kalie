"""
FastAPI dependencies — injected into route handlers.
"""
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import get_redis, is_token_blacklisted
from app.core.security import decode_token
from app.models.user import User
from app.services.user_service import UserService

bearer_scheme = HTTPBearer()
optional_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """
    Validates JWT and returns the authenticated user.
    Raises 401 if token is invalid, expired, or blacklisted.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(credentials.credentials)
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        jti: str = payload.get("jti", "")

        if user_id is None or token_type != "access":
            raise credentials_exception

        # Check blacklist
        if jti and await is_token_blacklisted(jti):
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    user_service = UserService(db)
    user = await user_service.get_by_id(user_id)

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta desativada",
        )

    return user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer),
    db: Annotated[AsyncSession, Depends(get_db)] = None,  # type: ignore
) -> User | None:
    """Like get_current_user, but returns None instead of 401 if unauthenticated."""
    if not credentials:
        return None
    try:
        payload = decode_token(credentials.credentials)
        user_id: str = payload.get("sub")
        if user_id is None or payload.get("type") != "access":
            return None
        jti: str = payload.get("jti", "")
        if jti and await is_token_blacklisted(jti):
            return None
        user_service = UserService(db)
        user = await user_service.get_by_id(user_id)
        if user and user.is_active:
            return user
    except Exception:
        return None
    return None


async def get_current_verified_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Requires email to be verified."""
    if not current_user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email não verificado. Verifique o seu email para continuar.",
        )
    return current_user


get_optional_current_user = get_optional_user

# Type aliases for cleaner route signatures
CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]
VerifiedUser = Annotated[User, Depends(get_current_verified_user)]
DB = Annotated[AsyncSession, Depends(get_db)]
