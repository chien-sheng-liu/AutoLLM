import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict


@dataclass
class Settings:
    data_dir: str
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
    temperature: float = 0.2
    fallback_chat_provider: str | None = None
    fallback_chat_model: str | None = None
    # Simple mode high-level controls
    ui_mode: str = "simple"  # 'simple' or 'advanced'
    preset: str = "qna"  # 'qna'|'summarize'|'extract'|'brainstorm'|'compliance'
    creativity: str = "balanced"  # 'precise'|'balanced'|'creative'
    answer_length: str = "medium"  # 'short'|'medium'|'long'
    show_sources: bool = True
    override_retrieval: bool = False
    override_generation: bool = False
    embedding_model: str = "text-embedding-3-small"
    embedding_dim: int = 1536
    # Generation params
    chunk_size: int = 1000
    chunk_overlap: int = 200
    top_k: int = 4
    max_tokens: int | None = None
    top_p: float | None = None
    presence_penalty: float | None = None
    frequency_penalty: float | None = None
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_token_minutes: int = 60
    redis_url: str | None = None
    redis_host: str = "redis"
    redis_port: int = 6379
    redis_username: str | None = None
    redis_password: str | None = None
    redis_db: int = 0
    # Intent Analysis Agent settings
    enable_intent_analysis: bool = True  # Set to False to bypass intent layer (legacy behaviour)
    intent_provider: str = ""  # Override provider for intent analysis; empty = use chat_provider
    intent_model: str = ""     # Override model for intent analysis; empty = use chat_model


def ensure_dirs(path: str) -> None:
    Path(path).mkdir(parents=True, exist_ok=True)


def get_defaults() -> Settings:
    data_dir = os.getenv("DATA_DIR", os.path.join("backend", "data"))
    ensure_dirs(data_dir)

    postgres_host = os.getenv("POSTGRES_HOST", "postgres")
    internal_port = os.getenv("POSTGRES_INTERNAL_PORT")
    if internal_port:
        postgres_port = int(internal_port)
    else:
        default_port = os.getenv("POSTGRES_PORT", "5432")
        # If we are talking to the docker-compose service, always use its internal 5432 port.
        postgres_port = 5432 if postgres_host == "postgres" else int(default_port)

    redis_url = os.getenv("REDIS_URL") or None
    redis_host = os.getenv("REDIS_HOST", "redis" if postgres_host == "postgres" else "localhost")
    redis_port = int(os.getenv("REDIS_PORT", "6379"))
    redis_username = os.getenv("REDIS_USERNAME") or None
    redis_password = os.getenv("REDIS_PASSWORD") or None
    redis_db = int(os.getenv("REDIS_DB", "0"))

    return Settings(
        data_dir=data_dir,
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
        temperature=float(os.getenv("RAG_TEMPERATURE", "0.2")),
        fallback_chat_provider=os.getenv("RAG_FALLBACK_PROVIDER") or None,
        fallback_chat_model=os.getenv("RAG_FALLBACK_MODEL") or None,
        ui_mode=os.getenv("RAG_UI_MODE", "simple"),
        preset=os.getenv("RAG_PRESET", "qna"),
        creativity=os.getenv("RAG_CREATIVITY", "balanced"),
        answer_length=os.getenv("RAG_ANSWER_LENGTH", "medium"),
        show_sources=os.getenv("RAG_SHOW_SOURCES", "true").lower() in ("1","true","yes"),
        override_retrieval=os.getenv("RAG_OVERRIDE_RETRIEVAL", "false").lower() in ("1","true","yes"),
        override_generation=os.getenv("RAG_OVERRIDE_GENERATION", "false").lower() in ("1","true","yes"),
        embedding_model=os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
        embedding_dim=int(os.getenv("EMBEDDING_DIM", "1536")),
        chunk_size=int(os.getenv("RAG_CHUNK_SIZE", "1000")),
        chunk_overlap=int(os.getenv("RAG_CHUNK_OVERLAP", "200")),
        top_k=int(os.getenv("RAG_TOP_K", "4")),
        max_tokens=int(os.getenv("RAG_MAX_TOKENS")) if os.getenv("RAG_MAX_TOKENS") else None,
        top_p=float(os.getenv("RAG_TOP_P")) if os.getenv("RAG_TOP_P") else None,
        presence_penalty=float(os.getenv("RAG_PRESENCE_PENALTY")) if os.getenv("RAG_PRESENCE_PENALTY") else None,
        frequency_penalty=float(os.getenv("RAG_FREQUENCY_PENALTY")) if os.getenv("RAG_FREQUENCY_PENALTY") else None,
        jwt_secret_key=os.getenv("JWT_SECRET_KEY", "change-me"),
        jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
        jwt_access_token_minutes=int(os.getenv("JWT_EXPIRES_MINUTES", "60")),
        redis_url=redis_url,
        redis_host=redis_host,
        redis_port=redis_port,
        redis_username=redis_username,
        redis_password=redis_password,
        redis_db=redis_db,
        enable_intent_analysis=os.getenv("ENABLE_INTENT_ANALYSIS", "true").lower() in ("1", "true", "yes"),
        intent_provider=os.getenv("INTENT_PROVIDER", ""),
        intent_model=os.getenv("INTENT_MODEL", ""),
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
                postgres_host=defaults.postgres_host,
                postgres_port=defaults.postgres_port,
                postgres_user=defaults.postgres_user,
                postgres_password=defaults.postgres_password,
                postgres_db=defaults.postgres_db,
                openai_api_key=(data.get("openai_api_key") or defaults.openai_api_key),
                google_api_key=(data.get("google_api_key") or defaults.google_api_key),
                anthropic_api_key=(data.get("anthropic_api_key") or defaults.anthropic_api_key),
                chat_provider=str(data.get("chat_provider", defaults.chat_provider)).lower(),
                embedding_provider=str(data.get("embedding_provider", defaults.embedding_provider)).lower(),
                chat_model=data.get("chat_model", defaults.chat_model),
                temperature=float(data.get("temperature", defaults.temperature)),
                embedding_model=data.get("embedding_model", defaults.embedding_model),
                embedding_dim=defaults.embedding_dim,
                chunk_size=int(data.get("chunk_size", defaults.chunk_size)),
                chunk_overlap=int(data.get("chunk_overlap", defaults.chunk_overlap)),
                top_k=int(data.get("top_k", defaults.top_k)),
                max_tokens=int(data.get("max_tokens")) if data.get("max_tokens") is not None else defaults.max_tokens,
                top_p=float(data.get("top_p")) if data.get("top_p") is not None else defaults.top_p,
                presence_penalty=float(data.get("presence_penalty")) if data.get("presence_penalty") is not None else defaults.presence_penalty,
                frequency_penalty=float(data.get("frequency_penalty")) if data.get("frequency_penalty") is not None else defaults.frequency_penalty,
                fallback_chat_provider=(data.get("fallback_chat_provider") or defaults.fallback_chat_provider),
                fallback_chat_model=(data.get("fallback_chat_model") or defaults.fallback_chat_model),
                ui_mode=str(data.get("ui_mode", defaults.ui_mode)),
                preset=str(data.get("preset", defaults.preset)),
                creativity=str(data.get("creativity", defaults.creativity)),
                answer_length=str(data.get("answer_length", defaults.answer_length)),
                show_sources=bool(data.get("show_sources", defaults.show_sources)),
                override_retrieval=bool(data.get("override_retrieval", defaults.override_retrieval)),
                override_generation=bool(data.get("override_generation", defaults.override_generation)),
                jwt_secret_key=str(data.get("jwt_secret_key", defaults.jwt_secret_key)),
                jwt_algorithm=str(data.get("jwt_algorithm", defaults.jwt_algorithm)),
                jwt_access_token_minutes=int(data.get("jwt_access_token_minutes", defaults.jwt_access_token_minutes)),
                redis_url=defaults.redis_url,
                redis_host=defaults.redis_host,
                redis_port=defaults.redis_port,
                redis_username=defaults.redis_username,
                redis_password=defaults.redis_password,
                redis_db=defaults.redis_db,
                enable_intent_analysis=bool(data.get("enable_intent_analysis", defaults.enable_intent_analysis)),
                intent_provider=str(data.get("intent_provider", defaults.intent_provider)),
                intent_model=str(data.get("intent_model", defaults.intent_model)),
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
                # Provider keys (persisted so admin can manage from settings page)
                "openai_api_key": cfg.openai_api_key,
                "google_api_key": cfg.google_api_key,
                "anthropic_api_key": cfg.anthropic_api_key,
                "chat_provider": cfg.chat_provider,
                "embedding_provider": cfg.embedding_provider,
                "chat_model": cfg.chat_model,
                "temperature": cfg.temperature,
                "embedding_model": cfg.embedding_model,
                "chunk_size": cfg.chunk_size,
                "chunk_overlap": cfg.chunk_overlap,
                "top_k": cfg.top_k,
                "max_tokens": cfg.max_tokens,
                "top_p": cfg.top_p,
                "presence_penalty": cfg.presence_penalty,
                "frequency_penalty": cfg.frequency_penalty,
                "fallback_chat_provider": cfg.fallback_chat_provider,
                "fallback_chat_model": cfg.fallback_chat_model,
                "ui_mode": cfg.ui_mode,
                "preset": cfg.preset,
                "creativity": cfg.creativity,
                "answer_length": cfg.answer_length,
                "show_sources": cfg.show_sources,
                "override_retrieval": cfg.override_retrieval,
                "override_generation": cfg.override_generation,
                # Auth / JWT (admin-managed)
                "jwt_secret_key": cfg.jwt_secret_key,
                "jwt_algorithm": cfg.jwt_algorithm,
                "jwt_access_token_minutes": cfg.jwt_access_token_minutes,
            },
            f,
            indent=2,
            ensure_ascii=False,
        )


def docs_dir(cfg: Settings) -> str:
    path = os.path.join(cfg.data_dir, "docs")
    ensure_dirs(path)
    return path
