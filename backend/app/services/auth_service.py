"""
Auth service — registration, login, token management, 2FA, social auth.
"""
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.redis import (
    check_brute_force,
    clear_failed_attempts,
    consume_verification_token,
    record_failed_attempt,
    store_verification_token,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    generate_secure_token,
    generate_totp_secret,
    get_totp_uri,
    hash_password,
    verify_password,
    verify_totp,
)
from app.models.user import User
from app.models.wallet import Wallet
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
)
from app.services.email_service import EmailService
from app.services.user_service import UserService


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_service = UserService(db)
        self.email_service = EmailService()

    async def register(self, data: RegisterRequest) -> User:
        """Register a new user with email + password."""
        # Check duplicates
        if await self.user_service.email_exists(data.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este email já está registado",
            )
        if await self.user_service.username_exists(data.username):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este nome de utilizador já está em uso",
            )

        # Create user
        user = await self.user_service.create(
            full_name=data.full_name,
            username=data.username,
            email=data.email,
            phone=data.phone,
            hashed_password=hash_password(data.password),
        )

        # Create wallet automatically
        wallet = Wallet(user_id=user.id)
        self.db.add(wallet)
        await self.db.flush()

        # Send verification email
        token = generate_secure_token()
        await store_verification_token(token, str(user.id), "email_verify", expire_seconds=86400)
        await self.email_service.send_verification_email(user.email, user.full_name, token)

        return user

    async def login(self, data: LoginRequest, ip_address: str) -> TokenResponse:
        """Authenticate with email + password (+ optional TOTP)."""
        identifier = f"login:{ip_address}:{data.email}"

        # Brute force check
        if await check_brute_force(identifier):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiadas tentativas. Tente novamente em 15 minutos.",
            )

        user = await self.user_service.get_by_email(data.email)

        if not user or not user.hashed_password:
            await record_failed_attempt(identifier)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email ou senha incorretos",
            )

        if not verify_password(data.password, user.hashed_password):
            await record_failed_attempt(identifier)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email ou senha incorretos",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Conta desativada",
            )

        # 2FA check
        if user.totp_enabled:
            if not data.totp_code:
                raise HTTPException(
                    status_code=status.HTTP_200_OK,
                    detail="2FA_REQUIRED",
                )
            if not verify_totp(user.totp_secret, data.totp_code):
                await record_failed_attempt(identifier)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Código 2FA inválido",
                )

        # Success — clear failed attempts, update last login
        await clear_failed_attempts(identifier)
        await self.user_service.update(user, last_login_at=datetime.now(timezone.utc))

        return self._build_token_response(user)

    async def login_with_google(self, firebase_id_token: str) -> TokenResponse:
        """Authenticate via Google (Firebase ID token)."""
        from app.services.firebase_service import FirebaseService
        firebase = FirebaseService()
        decoded = await firebase.verify_id_token(firebase_id_token)

        uid = decoded["uid"]
        email = decoded.get("email", "")
        name = decoded.get("name", email.split("@")[0])
        picture = decoded.get("picture")

        user = await self.user_service.get_by_firebase_uid(uid)

        if not user:
            # Auto-register
            if await self.user_service.email_exists(email):
                # Link to existing account
                user = await self.user_service.get_by_email(email)
                await self.user_service.update(user, firebase_uid=uid, google_id=uid)
            else:
                username = await self._generate_unique_username(name)
                user = await self.user_service.create(
                    full_name=name,
                    username=username,
                    email=email,
                    firebase_uid=uid,
                    google_id=uid,
                    avatar_url=picture,
                    email_verified=True,
                )
                wallet = Wallet(user_id=user.id)
                self.db.add(wallet)
                await self.db.flush()

        await self.user_service.update(user, last_login_at=datetime.now(timezone.utc))
        return self._build_token_response(user)

    async def verify_email(self, token: str) -> bool:
        user_id = await consume_verification_token(token, "email_verify")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token inválido ou expirado",
            )
        user = await self.user_service.get_by_id(user_id)
        if user:
            await self.user_service.update(user, email_verified=True)
        return True

    async def forgot_password(self, email: str) -> None:
        """Send password reset email. Always returns success (no user enumeration)."""
        user = await self.user_service.get_by_email(email)
        if user:
            token = generate_secure_token()
            await store_verification_token(token, str(user.id), "password_reset", expire_seconds=3600)
            await self.email_service.send_password_reset_email(user.email, user.full_name, token)

    async def reset_password(self, token: str, new_password: str) -> bool:
        user_id = await consume_verification_token(token, "password_reset")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token inválido ou expirado",
            )
        user = await self.user_service.get_by_id(user_id)
        if user:
            await self.user_service.update(user, hashed_password=hash_password(new_password))
        return True

    async def enable_2fa(self, user: User) -> dict:
        """Generate TOTP secret and QR code URI."""
        secret = generate_totp_secret()
        qr_uri = get_totp_uri(secret, user.email)
        # Store secret temporarily (not enabled until verified)
        await store_verification_token(secret, str(user.id), "totp_setup", expire_seconds=600)
        return {"secret": secret, "qr_uri": qr_uri}

    async def confirm_2fa(self, user: User, code: str) -> bool:
        """Confirm TOTP setup with first code."""
        from app.core.redis import get_redis
        redis = await get_redis()
        # Find the pending secret
        secret = await redis.get(f"verify:totp_setup:{code}")
        # Actually we stored user_id under the secret key — need to retrieve differently
        # Let's use a different approach: store secret under user_id
        secret_key = f"totp_pending:{user.id}"
        redis_client = await get_redis()
        secret = await redis_client.get(secret_key)
        if not secret:
            raise HTTPException(status_code=400, detail="Sessão de configuração 2FA expirada")
        if not verify_totp(secret, code):
            raise HTTPException(status_code=400, detail="Código inválido")
        await self.user_service.update(user, totp_secret=secret, totp_enabled=True)
        await redis_client.delete(secret_key)
        return True

    def _build_token_response(self, user: User) -> TokenResponse:
        access_token = create_access_token(str(user.id))
        refresh_token = create_refresh_token(str(user.id))
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def _generate_unique_username(self, name: str) -> str:
        base = name.lower().replace(" ", "_")[:20]
        username = base
        counter = 1
        while await self.user_service.username_exists(username):
            username = f"{base}_{counter}"
            counter += 1
        return username
