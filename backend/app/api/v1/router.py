"""
API v1 router — aggregates all module routers.
"""
from fastapi import APIRouter

from app.api.v1.endpoints import auth, users, feed, games
from app.api.v1.endpoints.games_ws import router as ws_router
from app.api.v1.endpoints.wallet import router as wallet_router
from app.api.v1.endpoints.raffles import router as raffles_router
from app.api.v1.endpoints.auctions import router as auctions_router
from app.api.v1.endpoints.events import router as events_router
from app.api.v1.endpoints.bisno import router as bisno_router
from app.api.v1.endpoints.sos import router as sos_router
from app.api.v1.endpoints.squid_ws import http_router as squid_http_router

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Autenticação"])
api_router.include_router(users.router, prefix="/users", tags=["Utilizadores"])
api_router.include_router(feed.router, prefix="/feed", tags=["Feed"])
api_router.include_router(games.router, prefix="/games", tags=["Jogos"])
api_router.include_router(wallet_router)
api_router.include_router(raffles_router)
api_router.include_router(auctions_router)
api_router.include_router(events_router)
api_router.include_router(bisno_router)
api_router.include_router(sos_router)
api_router.include_router(squid_http_router)
