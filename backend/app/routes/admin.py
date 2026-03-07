from typing import List

from fastapi import APIRouter, Depends, HTTPException

from ..config import load_config
from ..dependencies.auth import require_admin
from ..models.auth import UserOut
from ..storage.user_store import get_user_store
from ..storage.vector_store import VectorStore

router = APIRouter(prefix="/api/v1/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/users", response_model=List[UserOut])
def list_users(_: UserOut = Depends(require_admin)):
    cfg = load_config()
    store = get_user_store(cfg)
    return [
        UserOut(id=u["id"], email=u["email"], name=u.get("name"), role=u.get("role", "user"), created_at=u["created_at"])  # type: ignore
        for u in store.list_users()
    ]


@router.put("/users/{user_id}/auth")
def update_user_auth(user_id: str, payload: dict, _: UserOut = Depends(require_admin)):
    auth = str(payload.get("auth", "")).strip().lower()
    if auth == 'administrator':
        auth = 'admin'
    if auth not in ("admin", "manager", "user"):
        raise HTTPException(status_code=422, detail="auth must be 'admin'|'manager'|'user'")
    cfg = load_config()
    store = get_user_store(cfg)
    if not store.get_by_id(user_id):
        raise HTTPException(status_code=404, detail="user not found")
    store.set_auth(user_id, auth)
    return {"ok": True}


@router.get("/users/{user_id}/permissions")
def get_user_permissions(user_id: str, _: UserOut = Depends(require_admin)):
    cfg = load_config()
    store = get_user_store(cfg)
    if not store.get_by_id(user_id):
        raise HTTPException(status_code=404, detail="user not found")
    doc_ids = store.get_user_allowed_docs(user_id)
    return {"document_ids": doc_ids}


@router.put("/users/{user_id}/permissions")
def set_user_permissions(user_id: str, payload: dict, _: UserOut = Depends(require_admin)):
    cfg = load_config()
    store = get_user_store(cfg)
    if not store.get_by_id(user_id):
        raise HTTPException(status_code=404, detail="user not found")
    doc_ids = payload.get("document_ids", []) or []
    if not isinstance(doc_ids, list) or not all(isinstance(x, str) for x in doc_ids):
        raise HTTPException(status_code=422, detail="document_ids must be a list of strings")
    store.set_user_allowed_docs(user_id, doc_ids)
    return {"ok": True}


@router.get("/documents")
def list_documents(_: UserOut = Depends(require_admin)):
    cfg = load_config()
    store = VectorStore(cfg)
    return {"items": store.get_documents()}
