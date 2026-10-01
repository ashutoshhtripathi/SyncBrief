import time
from typing import Dict, Tuple
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Applies enterprise-grade security headers to all HTTP responses:
    - Content-Security-Policy (CSP)
    - Strict-Transport-Security (HSTS)
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: DENY
    - Referrer-Policy: strict-origin-when-cross-origin
    - Permissions-Policy
    """
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        
        # CSP: allow scripts from self and inline for Vite, dicebear avatars, and cdn assets
        csp = (
            "default-src 'self'; "
            "img-src 'self' data: https://api.dicebear.com https://*.dicebear.com https://images.unsplash.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com data:; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*;"
        )
        response.headers["Content-Security-Policy"] = csp
        
        return response

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    In-memory token bucket rate limiter per client IP.
    Default: 200 requests per 60-second window.
    """
    def __init__(self, app, max_requests: int = 200, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        # client_ip -> (request_count, reset_timestamp)
        self.clients: Dict[str, Tuple[int, float]] = {}

    async def dispatch(self, request: Request, call_next):
        # Exclude health check and docs from rate limiting
        path = request.url.path
        if path.startswith("/docs") or path.startswith("/redoc") or path == "/health":
            return await call_next(request)

        client_ip = request.client.host if request.client else "127.0.0.1"
        now = time.time()

        count, reset_time = self.clients.get(client_ip, (0, now + self.window_seconds))

        if now > reset_time:
            # Window expired, reset
            self.clients[client_ip] = (1, now + self.window_seconds)
        else:
            if count >= self.max_requests:
                retry_after = int(reset_time - now)
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Please slow down."},
                    headers={"Retry-After": str(max(1, retry_after))}
                )
            self.clients[client_ip] = (count + 1, reset_time)

        return await call_next(request)
