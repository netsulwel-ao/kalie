"""
Firebase Admin SDK — ID token verification for Google/Phone auth.
"""
import firebase_admin
from firebase_admin import auth, credentials

from app.core.config import settings

_initialized = False


def _init_firebase():
    global _initialized
    if not _initialized and settings.FIREBASE_PROJECT_ID:
        cred = credentials.Certificate({
            "type": "service_account",
            "project_id": settings.FIREBASE_PROJECT_ID,
            "private_key_id": settings.FIREBASE_PRIVATE_KEY_ID,
            "private_key": settings.FIREBASE_PRIVATE_KEY.replace("\\n", "\n"),
            "client_email": settings.FIREBASE_CLIENT_EMAIL,
            "client_id": settings.FIREBASE_CLIENT_ID,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        })
        firebase_admin.initialize_app(cred)
        _initialized = True


class FirebaseService:
    def __init__(self):
        _init_firebase()

    async def verify_id_token(self, id_token: str) -> dict:
        """Verify Firebase ID token and return decoded claims."""
        try:
            # clock_skew_seconds=60 tolera desfasamento de relógio até 60s
            decoded = auth.verify_id_token(id_token, clock_skew_seconds=60)
            return decoded
        except Exception as e:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Token Firebase inválido: {str(e)}",
            )
