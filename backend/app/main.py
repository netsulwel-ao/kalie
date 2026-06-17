"""
Kalie — FastAPI Entry Point
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.database import engine, Base
from app.api.v1.router import api_router
from app.core.middleware import SecurityHeadersMiddleware
from app.api.v1.endpoints.games_ws import router as game_ws_router
from app.api.v1.endpoints.squid_ws import router as squid_ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    # Create tables (Alembic handles migrations in prod)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


# Rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Kalie API",
    description="Angola's Super App — Wallet, Games, Social, SOS",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# ── Middleware (order matters — outermost first) ──────────────────────────────

# CORS — must be before security headers for preflight requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)

# Rate limiting (HTTP only — WebSockets bypass this via ASGI scope check)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Security headers — pure ASGI, passes WebSockets through untouched
app.add_middleware(SecurityHeadersMiddleware)

# Trusted hosts (production only)
if not settings.DEBUG:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.ALLOWED_HOSTS,
    )

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(api_router, prefix="/api/v1")
app.include_router(game_ws_router)   # WebSocket at /ws/game/{id}
app.include_router(squid_ws_router)  # WebSocket at /ws/squid/{code} + REST at /squid/rooms


@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "app": "kalie", "version": "1.0.0"}
