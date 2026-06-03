"""
Notifications + user search endpoints.

GET  /users/search?q=...          — search users by username/name
POST /games/challenges/{id}/invite/{user_id}  — invite user to game
GET  /notifications               — list my notifications
POST /notifications/{id}/read     — mark as read
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import or_, select

from app.core.deps import CurrentUser, DB
from app.models.user import User

router = APIRouter()


# ── User search ───────────────────────────────────────────────────────────────
@router.get("/search")
async def search_users(
    q: str = Query(..., min_length=2),
    db: DB = None,
    current_user: CurrentUser = None,
):
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
