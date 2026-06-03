"""
Application configuration — loaded from environment variables.
Never hardcode secrets here.
"""
from typing import List
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Em Docker, as variáveis chegam via environment/env_file do compose.
        # Em desenvolvimento local, lê o .env da raiz do projecto.
        env_file=(".env", ".env.dev"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ── App ──────────────────────────────────────────────────────────────────
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    API_PORT: int = 8000
    ALLOWED_HOSTS: List[str] = ["*"]

    # ── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: str
    POSTGRES_DB: str = "kalie"
    POSTGRES_USER: str = "kalie_user"
    POSTGRES_PASSWORD: str

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str
    REDIS_PASSWORD: str

    # ── JWT ──────────────────────────────────────────────────────────────────
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    # ── Firebase ─────────────────────────────────────────────────────────────
    FIREBASE_PROJECT_ID: str = ""
    FIREBASE_PRIVATE_KEY_ID: str = ""
    FIREBASE_PRIVATE_KEY: str = ""
    FIREBASE_CLIENT_EMAIL: str = ""
    FIREBASE_CLIENT_ID: str = ""

    # ── Email (Hostinger SMTP) ────────────────────────────────────────────────
    SMTP_HOST: str = "smtp.hostinger.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAILS_FROM_NAME: str = "Kalie"
    EMAILS_FROM_EMAIL: str = ""

    # ── Cloudinary ────────────────────────────────────────────────────────────
    CLOUDINARY_CLOUD_NAME: str = "dtczwmasd"
    CLOUDINARY_API_KEY: str = "759914494751934"
    CLOUDINARY_API_SECRET: str = "h3P81_87VWJEM5nhEhH8Lb02WRICloud"

    # ── Sulin Wallet ─────────────────────────────────────────────────────────
    SULIN_API_URL: str = "https://api.sulin.ao"
    SULIN_API_KEY: str = ""

    # ── CORS ─────────────────────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = ["http://localhost:5173"]

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 60

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_min_length(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters")
        return v

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"


settings = Settings()
