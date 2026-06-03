"""
Feed endpoints:
- GET  /feed              — paginated posts
- POST /feed              — create post
- POST /feed/{id}/like    — toggle like
- GET  /feed/{id}/comments
- POST /feed/{id}/comments
- GET  /messages/{user_id}  — conversation
- POST /messages/{user_id}  — send message
- GET  /messages            — list conversations
"""
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import desc, func, or_, select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DB, VerifiedUser
from app.models.feed import Comment, Message, Post, PostLike
from app.models.user import User

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────
class CreatePostRequest(BaseModel):
    content: str
    image_url: Optional[str] = None


class CreateCommentRequest(BaseModel):
    content: str


class SendMessageRequest(BaseModel):
    content: str


# ── Feed ──────────────────────────────────────────────────────────────────────
@router.get("")
async def get_feed(
    db: DB,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
):
    """Get paginated feed posts."""
    offset = (page - 1) * limit
    result = await db.execute(
        select(Post)
        .options(selectinload(Post.author), selectinload(Post.likes))
        .order_by(desc(Post.created_at))
        .offset(offset)
        .limit(limit)
    )
    posts = result.scalars().all()

    return {
        "posts": [
            {
                "id": str(p.id),
                "content": p.content,
                "image_url": p.image_url,
                "likes_count": p.likes_count,
                "comments_count": p.comments_count,
                "liked_by_me": any(str(l.user_id) == str(current_user.id) for l in p.likes),
                "created_at": p.created_at.isoformat(),
                "author": {
                    "id": str(p.author.id),
                    "username": p.author.username,
                    "full_name": p.author.full_name,
                    "avatar_url": p.author.avatar_url,
                },
            }
            for p in posts
        ],
        "page": page,
        "has_more": len(posts) == limit,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_post(data: CreatePostRequest, db: DB, current_user: VerifiedUser):
    """Create a new post."""
    if not data.content.strip():
        raise HTTPException(status_code=400, detail="Conteúdo não pode estar vazio")
    if len(data.content) > 2000:
        raise HTTPException(status_code=400, detail="Conteúdo demasiado longo (máx. 2000 caracteres)")

    post = Post(
        author_id=current_user.id,
        content=data.content.strip(),
        image_url=data.image_url,
    )
    db.add(post)
    await db.flush()
    await db.refresh(post)

    return {
        "id": str(post.id),
        "content": post.content,
        "image_url": post.image_url,
        "likes_count": 0,
        "comments_count": 0,
        "liked_by_me": False,
        "created_at": post.created_at.isoformat(),
        "author": {
            "id": str(current_user.id),
            "username": current_user.username,
            "full_name": current_user.full_name,
            "avatar_url": current_user.avatar_url,
        },
    }


@router.post("/{post_id}/like")
async def toggle_like(post_id: uuid.UUID, db: DB, current_user: CurrentUser):
    """Toggle like on a post."""
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")

    existing = await db.execute(
        select(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == current_user.id)
    )
    like = existing.scalar_one_or_none()

    if like:
        await db.delete(like)
        post.likes_count = max(0, post.likes_count - 1)
        liked = False
    else:
        db.add(PostLike(post_id=post_id, user_id=current_user.id))
        post.likes_count += 1
        liked = True

    await db.flush()
    return {"liked": liked, "likes_count": post.likes_count}


@router.get("/{post_id}/comments")
async def get_comments(post_id: uuid.UUID, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(Comment)
        .options(selectinload(Comment.author))
        .where(Comment.post_id == post_id)
        .order_by(Comment.created_at)
    )
    comments = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "content": c.content,
            "created_at": c.created_at.isoformat(),
            "author": {
                "id": str(c.author.id),
                "username": c.author.username,
                "full_name": c.author.full_name,
                "avatar_url": c.author.avatar_url,
            },
        }
        for c in comments
    ]


@router.post("/{post_id}/comments", status_code=status.HTTP_201_CREATED)
async def add_comment(post_id: uuid.UUID, data: CreateCommentRequest, db: DB, current_user: VerifiedUser):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")

    comment = Comment(post_id=post_id, author_id=current_user.id, content=data.content.strip())
    db.add(comment)
    post.comments_count += 1
    await db.flush()
    await db.refresh(comment)

    return {
        "id": str(comment.id),
        "content": comment.content,
        "created_at": comment.created_at.isoformat(),
        "author": {
            "id": str(current_user.id),
            "username": current_user.username,
            "full_name": current_user.full_name,
            "avatar_url": current_user.avatar_url,
        },
    }


# ── Messages ──────────────────────────────────────────────────────────────────
@router.get("/messages")
async def list_conversations(db: DB, current_user: CurrentUser):
    """List all conversations (last message per user)."""
    # Get distinct conversation partners
    result = await db.execute(
        select(Message)
        .where(or_(Message.sender_id == current_user.id, Message.receiver_id == current_user.id))
        .order_by(desc(Message.created_at))
    )
    messages = result.scalars().all()

    # Group by conversation partner
    seen: dict[str, dict] = {}
    for msg in messages:
        partner_id = str(msg.receiver_id) if str(msg.sender_id) == str(current_user.id) else str(msg.sender_id)
        if partner_id not in seen:
            seen[partner_id] = {
                "partner_id": partner_id,
                "last_message": msg.content,
                "last_message_at": msg.created_at.isoformat(),
                "unread": not msg.read and str(msg.receiver_id) == str(current_user.id),
            }

    # Fetch partner user info
    conversations = []
    for partner_id, conv in seen.items():
        partner = await db.get(User, uuid.UUID(partner_id))
        if partner:
            conversations.append({
                **conv,
                "partner": {
                    "id": str(partner.id),
                    "username": partner.username,
                    "full_name": partner.full_name,
                    "avatar_url": partner.avatar_url,
                },
            })

    return conversations


@router.get("/messages/{partner_id}")
async def get_conversation(partner_id: uuid.UUID, db: DB, current_user: CurrentUser):
    """Get messages between current user and partner."""
    result = await db.execute(
        select(Message)
        .where(
            or_(
                (Message.sender_id == current_user.id) & (Message.receiver_id == partner_id),
                (Message.sender_id == partner_id) & (Message.receiver_id == current_user.id),
            )
        )
        .order_by(Message.created_at)
    )
    messages = result.scalars().all()

    # Mark as read
    for msg in messages:
        if str(msg.receiver_id) == str(current_user.id) and not msg.read:
            msg.read = True
    await db.flush()

    return [
        {
            "id": str(m.id),
            "content": m.content,
            "is_mine": str(m.sender_id) == str(current_user.id),
            "read": m.read,
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]


@router.post("/messages/{partner_id}", status_code=status.HTTP_201_CREATED)
async def send_message(partner_id: uuid.UUID, data: SendMessageRequest, db: DB, current_user: VerifiedUser):
    """Send a message to any user (no friend request needed)."""
    partner = await db.get(User, partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    if not data.content.strip():
        raise HTTPException(status_code=400, detail="Mensagem não pode estar vazia")

    msg = Message(sender_id=current_user.id, receiver_id=partner_id, content=data.content.strip())
    db.add(msg)
    await db.flush()
    await db.refresh(msg)

    return {
        "id": str(msg.id),
        "content": msg.content,
        "is_mine": True,
        "read": False,
        "created_at": msg.created_at.isoformat(),
    }
