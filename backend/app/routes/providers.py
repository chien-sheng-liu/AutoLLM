from fastapi import APIRouter, Depends

from ..config import load_config
from ..services.providers.health import check_chat_provider, check_embedding_provider
from ..dependencies.auth import get_current_user


router = APIRouter(
    prefix="/api/v1/providers",
    tags=["providers"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/health")
def providers_health():
    cfg = load_config()
    chat = check_chat_provider(cfg)
    emb = check_embedding_provider(cfg)
    return {"chat": chat, "embedding": emb}
