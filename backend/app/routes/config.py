from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..config import load_config, save_config
from ..dependencies.auth import get_current_user


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
    chunk_size: int
    chunk_overlap: int
    top_k: int


@router.get("")
def get_config():
    cfg = load_config()
    return {
        "chat_provider": cfg.chat_provider,
        "embedding_provider": cfg.embedding_provider,
        "chat_model": cfg.chat_model,
        "embedding_model": cfg.embedding_model,
        "chunk_size": cfg.chunk_size,
        "chunk_overlap": cfg.chunk_overlap,
        "top_k": cfg.top_k,
    }


@router.put("")
def update_config(payload: ConfigPayload):
    cfg = load_config()
    if payload.chat_provider:
        cfg.chat_provider = payload.chat_provider.lower()
    if payload.embedding_provider:
        cfg.embedding_provider = payload.embedding_provider.lower()
    cfg.chat_model = payload.chat_model
    cfg.embedding_model = payload.embedding_model
    cfg.chunk_size = payload.chunk_size
    cfg.chunk_overlap = payload.chunk_overlap
    cfg.top_k = payload.top_k
    save_config(cfg)
    return {
        "chat_provider": cfg.chat_provider,
        "embedding_provider": cfg.embedding_provider,
        "chat_model": cfg.chat_model,
        "embedding_model": cfg.embedding_model,
        "chunk_size": cfg.chunk_size,
        "chunk_overlap": cfg.chunk_overlap,
        "top_k": cfg.top_k,
    }
