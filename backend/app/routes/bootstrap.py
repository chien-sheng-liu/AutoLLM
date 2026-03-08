from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field

from ..config import load_config
from ..services.auth import hash_password
from ..storage.user_store import get_user_store

router = APIRouter(prefix="/api/v1/admin/bootstrap", tags=["admin-bootstrap"])


class BootstrapPayload(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str | None = None


@router.get("/status")
def bootstrap_status():
    cfg = load_config()
    store = get_user_store(cfg)
    return {"has_users": store.count_users() > 0, "has_admin": store.any_admin_exists()}


@router.post("")
def bootstrap_admin(payload: BootstrapPayload):
    cfg = load_config()
    store = get_user_store(cfg)
    if store.any_admin_exists():
        raise HTTPException(status_code=403, detail="Admin already initialized")
    if store.get_by_email(str(payload.email)):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = store.create_user(str(payload.email), hash_password(payload.password), payload.name, role="admin")
    return {"ok": True, "admin": {"id": user["id"], "email": user["email"]}}

