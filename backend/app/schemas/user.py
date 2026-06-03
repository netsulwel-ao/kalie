"""
User schemas.
"""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class UserPublic(BaseModel):
    """Safe to expose publicly."""
    id: uuid.UUID
    username: str
    full_name: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserProfile(UserPublic):
    """Returned to the authenticated user themselves."""
    email: str
    phone: Optional[str] = None
    email_verified: bool
    phone_verified: bool
    totp_enabled: bool
    last_login_at: Optional[datetime] = None


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
