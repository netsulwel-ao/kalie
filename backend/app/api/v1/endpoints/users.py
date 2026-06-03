"""
User endpoints:
- GET  /users/me
- PATCH /users/me
- GET  /users/search?q=...
- GET  /users/{username}
"""
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import or_, select

from app.core.deps import CurrentUser, DB, VerifiedUser
from app.models.user import User
from app.schemas.user import UpdateProfileRequest, UserProfile, UserPublic
from app.services.user_service import UserService

router = APIRouter()


@router.get("/me", response_model=UserProfile)
async def get_my_profile(current_user: CurrentUser):
    """Retorna o perfil do utilizador autenticado."""
    return current_user


@router.patch("/me", response_model=UserProfile)
async def update_my_profile(
    data: UpdateProfileRequest,
    current_user: CurrentUser,
    db: DB,
):
    """Actualiza o perfil do utilizador autenticado."""
    service = UserService(db)
    updates = data.model_dump(exclude_none=True)
    if not updates:
        return current_user
    user = await service.update(current_user, **updates)
    return user


@router.get("/search")
async def search_users(
    q: str = Query(..., min_length=2),
    db: DB = None,
    current_user: CurrentUser = None,
):
    """Pesquisar utilizadores por nome ou username."""
    result = await db.execute(
        select(User)
        .where(
            or_(
                User.username.ilike(f"%{q}%"),
                User.full_name.ilike(f"%{q}%"),
            )
        )
        .where(User.id != current_user.id)
        .limit(10)
    )
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "username": u.username,
            "full_name": u.full_name,
            "avatar_url": u.avatar_url,
        }
        for u in users
    ]


@router.get("/{username}", response_model=UserPublic)
async def get_user_profile(username: str, db: DB):
    """Retorna o perfil público de um utilizador."""
    service = UserService(db)
    user = await service.get_by_username(username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilizador não encontrado",
        )
    return user
