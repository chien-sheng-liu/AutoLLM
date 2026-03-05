import json
import os
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict


@dataclass
class Settings:
    data_dir: str
    db_path: str
    postgres_host: str
    postgres_port: int
    postgres_user: str
    postgres_password: str
    postgres_db: str
    openai_api_key: str | None
    google_api_key: str | None
    anthropic_api_key: str | None
    chat_provider: str = "openai"  # one of: openai, gemini, anthropic
    embedding_provider: str = "openai"  # one of: openai, gemini
    chat_model: str = "gpt-4o-mini"
    embedding_model: str = "text-embedding-3-small"
    chunk_size: int = 1000
    chunk_overlap: int = 200
    top_k: int = 4
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_token_minutes: int = 60


def ensure_dirs(path: str) -> None:
    Path(path).mkdir(parents=True, exist_ok=True)


def get_defaults() -> Settings:
    data_dir = os.getenv("DATA_DIR", os.path.join("backend", "data"))
    ensure_dirs(data_dir)
    db_path = os.getenv("DB_PATH", os.path.join(data_dir, "rag.sqlite"))

    postgres_host = os.getenv("POSTGRES_HOST", "postgres")
    internal_port = os.getenv("POSTGRES_INTERNAL_PORT")
    if internal_port:
        postgres_port = int(internal_port)
    else:
        default_port = os.getenv("POSTGRES_PORT", "5432")
        # If we are talking to the docker-compose service, always use its internal 5432 port.
        postgres_port = 5432 if postgres_host == "postgres" else int(default_port)

    return Settings(
        data_dir=data_dir,
        db_path=db_path,
        postgres_host=postgres_host,
        postgres_port=postgres_port,
        postgres_user=os.getenv("POSTGRES_USER", "autollm"),
        postgres_password=os.getenv("POSTGRES_PASSWORD", "postgres"),
        postgres_db=os.getenv("POSTGRES_DB", "autollm"),
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        google_api_key=os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY"),
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
        chat_provider=os.getenv("CHAT_PROVIDER", "openai").lower(),
        embedding_provider=os.getenv("EMBEDDING_PROVIDER", "openai").lower(),
        chat_model=os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini"),
        embedding_model=os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
        chunk_size=int(os.getenv("RAG_CHUNK_SIZE", "1000")),
        chunk_overlap=int(os.getenv("RAG_CHUNK_OVERLAP", "200")),
        top_k=int(os.getenv("RAG_TOP_K", "4")),
        jwt_secret_key=os.getenv("JWT_SECRET_KEY", "change-me"),
        jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
        jwt_access_token_minutes=int(os.getenv("JWT_EXPIRES_MINUTES", "60")),
    )


def config_path(settings: Settings) -> str:
    return os.path.join(settings.data_dir, "config.json")


def load_config() -> Settings:
    defaults = get_defaults()
    cfg_p = config_path(defaults)
    if os.path.exists(cfg_p):
        try:
            with open(cfg_p, "r", encoding="utf-8") as f:
                data: Dict[str, Any] = json.load(f)
            # Merge file values over defaults
            return Settings(
                data_dir=defaults.data_dir,
                db_path=defaults.db_path,
                postgres_host=defaults.postgres_host,
                postgres_port=defaults.postgres_port,
                postgres_user=defaults.postgres_user,
                postgres_password=defaults.postgres_password,
                postgres_db=defaults.postgres_db,
                openai_api_key=defaults.openai_api_key,
                google_api_key=defaults.google_api_key,
                anthropic_api_key=defaults.anthropic_api_key,
                chat_provider=str(data.get("chat_provider", defaults.chat_provider)).lower(),
                embedding_provider=str(data.get("embedding_provider", defaults.embedding_provider)).lower(),
                chat_model=data.get("chat_model", defaults.chat_model),
                embedding_model=data.get("embedding_model", defaults.embedding_model),
                chunk_size=int(data.get("chunk_size", defaults.chunk_size)),
                chunk_overlap=int(data.get("chunk_overlap", defaults.chunk_overlap)),
                top_k=int(data.get("top_k", defaults.top_k)),
                jwt_secret_key=defaults.jwt_secret_key,
                jwt_algorithm=defaults.jwt_algorithm,
                jwt_access_token_minutes=defaults.jwt_access_token_minutes,
            )
        except Exception:
            # Fall back to defaults if parsing fails
            return defaults
    return defaults


def save_config(cfg: Settings) -> None:
    ensure_dirs(cfg.data_dir)
    with open(config_path(cfg), "w", encoding="utf-8") as f:
        json.dump(
            {
                "chat_provider": cfg.chat_provider,
                "embedding_provider": cfg.embedding_provider,
                "chat_model": cfg.chat_model,
                "embedding_model": cfg.embedding_model,
                "chunk_size": cfg.chunk_size,
                "chunk_overlap": cfg.chunk_overlap,
                "top_k": cfg.top_k,
            },
            f,
            indent=2,
            ensure_ascii=False,
        )


def docs_dir(cfg: Settings) -> str:
    path = os.path.join(cfg.data_dir, "docs")
    ensure_dirs(path)
    return path
