from fastapi import FastAPI
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware

from .routes.auth import router as auth_router
from .routes.chat import router as chat_router
from .routes.docs import router as docs_router
from .routes.admin import router as admin_router
from .routes.config import router as config_router
from .routes.providers import router as providers_router
from .routes.feedback import router as feedback_router
from .routes.bootstrap import router as bootstrap_router


def create_app() -> FastAPI:
    app = FastAPI(title="No-Code RAG Chatbot API", version="0.1.0")

    # Broad CORS for dev; restrict in prod
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/healthz")
    def healthz():
        return {"ok": True}

    # Friendly root for quick checks
    @app.get("/")
    def root():
        return JSONResponse({
            "ok": True,
            "message": "No-Code RAG Chatbot backend",
            "docs": "/docs",
            "health": "/healthz",
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

    return app


app = create_app()
