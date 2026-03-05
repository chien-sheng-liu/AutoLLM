from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes.chat import router as chat_router
from .routes.docs import router as docs_router
from .routes.config import router as config_router
from .routes.providers import router as providers_router


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

    app.include_router(config_router)
    app.include_router(docs_router)
    app.include_router(chat_router)
    app.include_router(providers_router)
    return app


app = create_app()
