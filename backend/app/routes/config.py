from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..config import load_config, save_config
from ..dependencies.auth import get_current_user, require_admin


router = APIRouter(
    prefix="/api/v1/config",
    tags=["config"],
    dependencies=[Depends(get_current_user)],
)


class ConfigPayload(BaseModel):
    chat_provider: str | None = None
    embedding_provider: str | None = None
    chat_model: str
    embedding_model: str
    temperature: float | None = None
    chunk_size: int
    chunk_overlap: int
    top_k: int
    fallback_chat_provider: str | None = None
    fallback_chat_model: str | None = None
    max_tokens: int | None = None
    top_p: float | None = None
    presence_penalty: float | None = None
    frequency_penalty: float | None = None
    # Simple mode controls
    ui_mode: str | None = None
    preset: str | None = None
    creativity: str | None = None
    answer_length: str | None = None
    show_sources: bool | None = None
    override_retrieval: bool | None = None
    override_generation: bool | None = None


@router.get("")
def get_config():
    cfg = load_config()
    return {
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
    }


@router.put("")
def update_config(payload: ConfigPayload, _: str = Depends(require_admin)):
    cfg = load_config()
    # Update high-level fields first
    if payload.ui_mode:
        cfg.ui_mode = payload.ui_mode
    if payload.preset:
        cfg.preset = payload.preset
    if payload.creativity:
        cfg.creativity = payload.creativity
    if payload.answer_length:
        cfg.answer_length = payload.answer_length
    if payload.show_sources is not None:
        cfg.show_sources = bool(payload.show_sources)
    if payload.override_retrieval is not None:
        cfg.override_retrieval = bool(payload.override_retrieval)
    if payload.override_generation is not None:
        cfg.override_generation = bool(payload.override_generation)
    if payload.chat_provider:
        cfg.chat_provider = payload.chat_provider.lower()
    if payload.embedding_provider:
        cfg.embedding_provider = payload.embedding_provider.lower()
    cfg.chat_model = payload.chat_model
    cfg.embedding_model = payload.embedding_model
    if payload.temperature is not None:
        cfg.temperature = float(payload.temperature)
    cfg.chunk_size = payload.chunk_size
    cfg.chunk_overlap = payload.chunk_overlap
    cfg.top_k = payload.top_k
    cfg.max_tokens = payload.max_tokens
    cfg.top_p = payload.top_p
    cfg.presence_penalty = payload.presence_penalty
    cfg.frequency_penalty = payload.frequency_penalty
    if payload.fallback_chat_provider:
        cfg.fallback_chat_provider = payload.fallback_chat_provider.lower()
    else:
        cfg.fallback_chat_provider = None
    if payload.fallback_chat_model:
        cfg.fallback_chat_model = payload.fallback_chat_model
    else:
        cfg.fallback_chat_model = None

    # Derive params in simple mode if not overridden
    def derive_from_simple():
        # Creativity → temperature/top_p/penalties
        if cfg.creativity == "precise":
            cfg.temperature = 0.2
            cfg.top_p = 1.0
            cfg.presence_penalty = 0.0
            cfg.frequency_penalty = 0.0
        elif cfg.creativity == "creative":
            cfg.temperature = 0.9
            cfg.top_p = 1.0
            cfg.presence_penalty = 0.2
            cfg.frequency_penalty = 0.1
        else:  # balanced
            cfg.temperature = 0.5
            cfg.top_p = 1.0
            cfg.presence_penalty = 0.0
            cfg.frequency_penalty = 0.0

        # Answer length → max_tokens
        if cfg.answer_length == "short":
            cfg.max_tokens = 256
        elif cfg.answer_length == "long":
            cfg.max_tokens = 1024
        else:
            cfg.max_tokens = 512

        # Preset → retrieval + chunk strategy
        if cfg.preset == "summarize":
            cfg.top_k = 6
            cfg.chunk_size = 1200
            cfg.chunk_overlap = 250
        elif cfg.preset == "extract":
            cfg.top_k = 3
            cfg.chunk_size = 800
            cfg.chunk_overlap = 150
        elif cfg.preset == "compliance":
            cfg.top_k = 5
            cfg.chunk_size = 1000
            cfg.chunk_overlap = 200
            if cfg.temperature and cfg.temperature > 0.3:
                cfg.temperature = 0.3
        else:  # qna or brainstorm default
            cfg.top_k = 4
            cfg.chunk_size = 1000
            cfg.chunk_overlap = 200

    if (cfg.ui_mode or "simple") == "simple":
        # Only derive for areas not overridden
        if not cfg.override_retrieval or not cfg.override_generation:
            # Keep current values for overridden sections
            prev_top_k, prev_cs, prev_co = cfg.top_k, cfg.chunk_size, cfg.chunk_overlap
            prev_temp, prev_tp, prev_pp, prev_fp, prev_mt = cfg.temperature, cfg.top_p, cfg.presence_penalty, cfg.frequency_penalty, cfg.max_tokens
            derive_from_simple()
            if cfg.override_retrieval:
                cfg.top_k, cfg.chunk_size, cfg.chunk_overlap = prev_top_k, prev_cs, prev_co
            if cfg.override_generation:
                cfg.temperature, cfg.top_p, cfg.presence_penalty, cfg.frequency_penalty, cfg.max_tokens = prev_temp, prev_tp, prev_pp, prev_fp, prev_mt

    save_config(cfg)
    return {
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
    }
