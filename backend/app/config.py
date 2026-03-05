import json
import os
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict


@dataclass
class Settings:
    data_dir: str
    db_path: str
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


def ensure_dirs(path: str) -> None:
    Path(path).mkdir(parents=True, exist_ok=True)


def get_defaults() -> Settings:
    data_dir = os.getenv("DATA_DIR", os.path.join("backend", "data"))
    ensure_dirs(data_dir)
    db_path = os.getenv("DB_PATH", os.path.join(data_dir, "rag.sqlite"))
    return Settings(
        data_dir=data_dir,
        db_path=db_path,
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
