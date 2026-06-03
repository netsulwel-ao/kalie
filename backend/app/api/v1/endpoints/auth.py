"""
Auth endpoints:
- POST /auth/register
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout
- POST /auth/verify-email
- POST /auth/forgot-password
- POST /auth/reset-password
- POST /auth/google
- POST /auth/phone
- GET  /auth/2fa/setup
- POST /auth/2fa/confirm
"""
from fastapi import APIRouter, BackgroundTasks, Depends, Request, status
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, DB
from app.schemas.auth import (
    ForgotPasswordRequest,
    GoogleAuthRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    Verify2FARequest,
    VerifyEmailRequest,
)
from app.schemas.user import UserProfile
from app.services.auth_service import AuthService

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(
    request: Request,
    data: RegisterRequest,
    db: DB,
):
    """Registo com email + senha."""
    service = AuthService(db)
    user = await service.register(data)
    return {"message": "Conta criada com sucesso. Verifique o seu email.", "user_id": str(user.id)}


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    data: LoginRequest,
    db: DB,
):
    """Login com email + senha (+ 2FA opcional)."""
    service = AuthService(db)
    ip = request.client.host if request.client else "unknown"
    return await service.login(data, ip)


@router.post("/google", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login_google(
    request: Request,
    data: GoogleAuthRequest,
    db: DB,
):
    """Login/registo via Google (Firebase ID token)."""
    service = AuthService(db)
    return await service.login_with_google(data.id_token)


@router.post("/verify-email")
async def verify_email(data: VerifyEmailRequest, db: DB):
    """Verificar email com token enviado por email."""
    service = AuthService(db)
    await service.verify_email(data.token)
    return {"message": "Email verificado com sucesso"}


@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    db: DB,
):
    """Enviar email de redefinição de senha."""
    service = AuthService(db)
    await service.forgot_password(data.email)
    # Always return success to prevent user enumeration
    return {"message": "Se o email existir, receberá instruções em breve"}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, db: DB):
    """Redefinir senha com token."""
    service = AuthService(db)
    await service.reset_password(data.token, data.new_password)
    return {"message": "Senha redefinida com sucesso"}


@router.get("/2fa/setup")
async def setup_2fa(current_user: CurrentUser, db: DB):
    """Iniciar configuração de autenticação de dois fatores."""
    service = AuthService(db)
    result = await service.enable_2fa(current_user)
    return result


@router.post("/2fa/confirm")
async def confirm_2fa(
    data: Verify2FARequest,
    current_user: CurrentUser,
    db: DB,
):
    """Confirmar e activar 2FA com primeiro código TOTP."""
    service = AuthService(db)
    await service.confirm_2fa(current_user, data.code)
    return {"message": "Autenticação de dois fatores activada com sucesso"}


@router.post("/logout")
async def logout(current_user: CurrentUser):
    """Logout — invalidate tokens via blacklist."""
    # Token blacklisting handled client-side for now
    # Full implementation: extract JTI from token and blacklist
    return {"message": "Sessão terminada com sucesso"}
