"""
Custom middleware:
- Security headers (XSS, clickjacking, MIME sniffing, etc.)
- Request ID injection

NOTE: Uses pure ASGI middleware (not BaseHTTPMiddleware) to avoid
      blocking WebSocket connections.
"""
import uuid

from starlette.types import ASGIApp, Receive, Scope, Send
from starlette.datastructures import MutableHeaders


class SecurityHeadersMiddleware:
    """
    Pure ASGI middleware — adds security headers to HTTP responses only.
    WebSocket connections are passed through untouched.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        # Only process HTTP requests — pass WebSockets straight through
        if scope["type"] not in ("http",):
            await self.app(scope, receive, send)
            return

        request_id = str(uuid.uuid4())

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers["X-Request-ID"] = request_id
                headers["X-Content-Type-Options"] = "nosniff"
                headers["X-Frame-Options"] = "DENY"
                headers["X-XSS-Protection"] = "1; mode=block"
                headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
                headers["Permissions-Policy"] = (
                    "camera=(), microphone=(), geolocation=(self), payment=()"
                )
                headers["Content-Security-Policy"] = (
                    "default-src 'self'; "
                    "script-src 'self' 'unsafe-inline'; "
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                    "font-src 'self' https://fonts.gstatic.com; "
                    "img-src 'self' data: https: blob:; "
                    "connect-src 'self' ws: wss:; "
                    "frame-ancestors 'none';"
                )
            await send(message)

        await self.app(scope, receive, send_with_headers)
