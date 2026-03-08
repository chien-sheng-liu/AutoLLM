import os
from typing import List

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr

from ..config import load_config, docs_dir
from ..models.docs import UploadResponse, DocumentList, DocumentInfo
from ..dependencies.auth import get_current_user, require_admin, require_manager
from ..models.auth import UserOut
from ..storage.vector_store import VectorStore
from ..storage.vector_redis_store import RedisVectorStore
from ..services.embeddings import EmbeddingService
from ..services.rag import chunk_text
from ..storage.user_store import get_user_store


class DocPermissionsPayload(BaseModel):
    user_ids: list[str]


class DocPermissionsResponse(BaseModel):
    user_ids: list[str]


class PermissionUserOut(BaseModel):
    user_id: str
    email: EmailStr
    name: str | None = None
    auth: str

router = APIRouter(
    prefix="/api/v1/docs",
    tags=["docs"],
    dependencies=[Depends(get_current_user)],
)


def _is_admin_auth(auth_value: str | None) -> bool:
    return (auth_value or "user").lower() in ("admin", "administrator")


def _read_file_content(path: str) -> str:
    if path.lower().endswith(".txt"):
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    elif path.lower().endswith(".pdf"):
        try:
            from pypdf import PdfReader
            from pypdf.errors import DependencyError as PdfDependencyError
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"PDF 解析環境錯誤：{e}")
        try:
            reader = PdfReader(path)
        except PdfDependencyError as e:
            # Typically cryptography not installed for AES encrypted PDFs
            raise HTTPException(status_code=500, detail="解析 PDF 需要加密函式庫（cryptography），請聯絡系統管理員安裝依賴或上傳未加密的 PDF。")
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"無法開啟 PDF：{e}")
        if getattr(reader, "is_encrypted", False):
            try:
                # Try empty password if possible
                reader.decrypt("")
            except Exception:
                pass
            # If still encrypted, reject
            if getattr(reader, "is_encrypted", False):
                raise HTTPException(status_code=422, detail="無法解析加密的 PDF，請上傳未加密檔案或轉為文字。")
        texts: List[str] = []
        for page in reader.pages:
            texts.append(page.extract_text() or "")
        return "\n".join(texts)
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type (use .txt or .pdf)")


@router.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...), current_user=Depends(require_manager)):
    cfg = load_config()
    # Validate embedding provider/API key via service initialization
    docs_path = docs_dir(cfg)
    store = VectorStore(cfg)
    rstore = RedisVectorStore(cfg)
    embedder = EmbeddingService.from_config(cfg)

    # Persist file first
    filename = file.filename or "uploaded"
    doc_id = store.add_document(name=filename, source="upload")
    # Mirror document metadata into Redis for retrieval
    try:
        rstore.set_document(doc_id, name=filename, source="upload")
    except Exception:
        pass
    ext = os.path.splitext(filename)[1] or ".txt"
    save_path = os.path.join(docs_path, f"{doc_id}{ext}")
    contents = await file.read()
    with open(save_path, "wb") as f:
        f.write(contents)

    # Ingest
    texts: List[str] = []
    metadatas: List[dict] = []
    if ext.lower() == ".pdf":
        try:
            from pypdf import PdfReader
            from pypdf.errors import DependencyError as PdfDependencyError
            reader = PdfReader(save_path)
            if getattr(reader, "is_encrypted", False):
                try:
                    reader.decrypt("")
                except Exception:
                    pass
                if getattr(reader, "is_encrypted", False):
                    raise HTTPException(status_code=422, detail="無法解析加密的 PDF，請上傳未加密檔案或轉為文字。")
            for idx, page in enumerate(reader.pages, start=1):
                page_text = page.extract_text() or ""
                for ch in chunk_text(page_text, cfg.chunk_size, cfg.chunk_overlap):
                    texts.append(ch)
                    metadatas.append({"ext": ext, "name": filename, "page": idx})
        except PdfDependencyError:
            raise HTTPException(status_code=500, detail="解析 PDF 需要加密函式庫（cryptography），請聯絡系統管理員安裝依賴或上傳未加密的 PDF。")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"無法解析 PDF：{e}")
    else:
        text = _read_file_content(save_path)
        for ch in chunk_text(text, cfg.chunk_size, cfg.chunk_overlap):
            texts.append(ch)
            metadatas.append({"ext": ext, "name": filename, "page": 1})

    chunk_ids = store.add_chunks(doc_id, texts, metadatas=metadatas)
    # Mirror chunks to Redis with identical IDs
    try:
        rstore.add_chunks_with_ids(doc_id, chunk_ids, texts, metadatas=metadatas)
    except Exception:
        pass
    vectors = embedder.embed_texts(texts)
    store.upsert_embeddings(chunk_ids, vectors)
    # Also write embeddings to Redis (chat retrieval reads from Redis)
    try:
        rstore.upsert_embeddings(chunk_ids, vectors)
    except Exception:
        pass

    # Grant uploader access (permissioned mode)
    try:
        from ..storage.user_store import get_user_store as _get_us
        us = _get_us(cfg)
        current = us.get_user_allowed_docs(current_user.id)
        if doc_id not in current:
            us.set_user_allowed_docs(current_user.id, [doc_id, *current])
    except Exception:
        pass
    return UploadResponse(document_id=doc_id, name=filename)


@router.get("", response_model=DocumentList)
def list_documents(_: UserOut = Depends(get_current_user)):
    cfg = load_config()
    store = VectorStore(cfg)
    # Show all documents to any authenticated user; modifications remain restricted elsewhere
    items = [DocumentInfo(**d) for d in store.get_documents()]
    return DocumentList(items=items)


## Removed content search endpoint per request


@router.delete("/{document_id:uuid}")
def delete_document(document_id: str, _: str = Depends(require_admin)):
    cfg = load_config()
    store = VectorStore(cfg)
    rstore = RedisVectorStore(cfg)
    # Remove metadata/embeddings
    store.delete_document(document_id)
    try:
        rstore.delete_document(document_id)
    except Exception:
        pass
    # Remove file if exists
    dd = docs_dir(cfg)
    for file in os.listdir(dd):
        if file.startswith(document_id + "."):
            try:
                os.remove(os.path.join(dd, file))
            except FileNotFoundError:
                pass
    return {"ok": True}


@router.get("/permissions/users", response_model=List[PermissionUserOut])
def list_permission_users(_: str = Depends(require_manager)):
    cfg = load_config()
    store = get_user_store(cfg)
    items = []
    for u in store.list_users():
        items.append(
            PermissionUserOut(
                user_id=u["id"],
                email=u["email"],
                name=u.get("name"),
                auth=(u.get("auth") or "user"),
            )
        )
    return items


def _ensure_doc_exists(store: VectorStore, document_id: str):
    if not store.document_exists(document_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")


@router.get("/{document_id:uuid}/permissions", response_model=DocPermissionsResponse)
def get_document_permissions(document_id: str, _: str = Depends(require_manager)):
    cfg = load_config()
    vstore = VectorStore(cfg)
    _ensure_doc_exists(vstore, document_id)
    ust = get_user_store(cfg)
    raw_ids = ust.get_doc_allowed_users(document_id)
    filtered: list[str] = []
    for uid in raw_ids:
        user = ust.get_by_id(uid)
        if user and _is_admin_auth(user.get("auth")):
            continue
        filtered.append(uid)
    return DocPermissionsResponse(user_ids=filtered)


@router.put("/{document_id:uuid}/permissions")
def set_document_permissions(document_id: str, payload: DocPermissionsPayload, _: str = Depends(require_manager)):
    cfg = load_config()
    vstore = VectorStore(cfg)
    _ensure_doc_exists(vstore, document_id)
    ust = get_user_store(cfg)
    user_ids = payload.user_ids or []
    filtered: list[str] = []
    for uid in user_ids:
        user = ust.get_by_id(uid)
        if not user:
            continue
        if _is_admin_auth(user.get("auth")):
            continue
        filtered.append(uid)
    ust.set_doc_allowed_users(document_id, filtered)
    return {"ok": True}
