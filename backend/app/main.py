import os
import logging
from logging.config import dictConfig
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi import HTTPException
from starlette import status
from fastapi.middleware.cors import CORSMiddleware

from .routes.auth import router as auth_router
from .routes.chat import router as chat_router
from .routes.docs import router as docs_router
from .routes.admin import router as admin_router
from .routes.config import router as config_router
from .routes.providers import router as providers_router
from .routes.feedback import router as feedback_router
from .routes.bootstrap import router as bootstrap_router
from .routes.prompts import router as prompts_router


def _parse_cors_origins() -> list[str]:
    raw = os.getenv("BACKEND_CORS_ORIGINS") or os.getenv("CORS_ALLOW_ORIGINS")
    if not raw:
        # Default: allow all for local/dev. Set env in prod.
        return ["*"]
    items = [s.strip() for s in raw.split(",") if s.strip()]
    # Support wildcard single value "*"
    return items if items else ["*"]


def create_app() -> FastAPI:
    app = FastAPI(title="No-Code RAG Chatbot API", version="0.1.0")

    # Logging (production‑oriented, no request bodies)
    level = os.getenv("LOG_LEVEL", "INFO").upper()
    dictConfig({
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {"format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s"},
        },
        "handlers": {
            "console": {"class": "logging.StreamHandler", "formatter": "default", "level": level},
        },
        "loggers": {
            "": {"handlers": ["console"], "level": level},
            "uvicorn": {"handlers": ["console"], "level": level, "propagate": False},
            "uvicorn.error": {"level": level},
            "uvicorn.access": {"level": level},
        },
    })
    log = logging.getLogger(__name__)

    # CORS: use env to restrict in production
    allow_origins = _parse_cors_origins()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Request ID middleware (propagate incoming X-Request-ID or generate one)
    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        rid = request.headers.get("X-Request-ID")
        if not rid:
            # lightweight random id; no PII
            import uuid
            rid = uuid.uuid4().hex[:16]
        request.state.request_id = rid
        response = await call_next(request)
        response.headers.setdefault("X-Request-ID", rid)
        return response

    # Minimal security headers for API responses
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        # Do not set HSTS here (TLS termination likely handled by proxy)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        return response

    # Error handlers: return safe, consistent payloads
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        rid = getattr(request.state, "request_id", None)
        detail = exc.detail
        if isinstance(detail, dict):
            payload = {"ok": False, **detail, "request_id": rid}
            if "error" not in payload:
                payload["error"] = exc.__class__.__name__
            return JSONResponse(status_code=exc.status_code, content=payload)
        return JSONResponse(
            status_code=exc.status_code,
            content={"ok": False, "error": str(detail) if detail else exc.__class__.__name__, "request_id": rid},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        # Log minimal context; do not log request body or headers
        log.exception("Unhandled error at %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"ok": False, "error": "Internal Server Error", "request_id": getattr(request.state, "request_id", None)},
        )

    # Access log middleware (method, path, status, duration, request id)
    @app.middleware("http")
    async def access_log(request: Request, call_next):
        import time
        start = time.perf_counter()
        response = await call_next(request)
        dur_ms = int((time.perf_counter() - start) * 1000)
        rid = getattr(request.state, "request_id", None)
        logging.getLogger("access").info("%s %s -> %s %dms rid=%s", request.method, request.url.path, response.status_code, dur_ms, rid)
        return response

    @app.get("/healthz")
    def healthz(request: Request):
        return {"ok": True, "request_id": getattr(request.state, "request_id", None)}

    # Friendly root for quick checks
    @app.get("/")
    def root(request: Request):
        return JSONResponse({
            "ok": True,
            "message": "No-Code RAG Chatbot backend",
            "docs": "/docs",
            "health": "/healthz",
            "request_id": getattr(request.state, "request_id", None),
            "api_examples": {
                "login": "/api/v1/auth/login",
                "me": "/api/v1/auth/me",
                "config": "/api/v1/config",
            },
        })

    app.include_router(auth_router)
    app.include_router(config_router)
    app.include_router(docs_router)
    app.include_router(chat_router)
    app.include_router(providers_router)
    app.include_router(feedback_router)
    app.include_router(admin_router)
    app.include_router(bootstrap_router)
    app.include_router(prompts_router)

    return app


app = create_app()
