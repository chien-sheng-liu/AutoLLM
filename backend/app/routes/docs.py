import os
from typing import List

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends

from ..config import load_config, docs_dir
from ..models.docs import UploadResponse, DocumentList, DocumentInfo
from ..dependencies.auth import get_current_user
from ..storage.vector_store import VectorStore
from ..services.embeddings import EmbeddingService
from ..services.rag import chunk_text

router = APIRouter(
    prefix="/api/v1/docs",
    tags=["docs"],
    dependencies=[Depends(get_current_user)],
)


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
async def upload_document(file: UploadFile = File(...)):
    cfg = load_config()
    # Validate embedding provider/API key via service initialization
    docs_path = docs_dir(cfg)
    store = VectorStore(cfg)
    embedder = EmbeddingService.from_config(cfg)

    # Persist file first
    filename = file.filename or "uploaded"
    doc_id = store.add_document(name=filename, source="upload")
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
    vectors = embedder.embed_texts(texts)
    store.upsert_embeddings(chunk_ids, vectors)

    return UploadResponse(document_id=doc_id, name=filename)


@router.get("", response_model=DocumentList)
def list_documents():
    cfg = load_config()
    store = VectorStore(cfg)
    items = [DocumentInfo(**d) for d in store.get_documents()]
    return DocumentList(items=items)


## Removed content search endpoint per request


@router.delete("/{document_id:uuid}")
def delete_document(document_id: str):
    cfg = load_config()
    store = VectorStore(cfg)
    # Remove metadata/embeddings
    store.delete_document(document_id)
    # Remove file if exists
    dd = docs_dir(cfg)
    for file in os.listdir(dd):
        if file.startswith(document_id + "."):
            try:
                os.remove(os.path.join(dd, file))
            except FileNotFoundError:
                pass
    return {"ok": True}
