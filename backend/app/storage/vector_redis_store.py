from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np
import redis

from ..config import Settings
from .vector_store import ChunkRecord


@dataclass
class _DocMeta:
    id: str
    name: str
    source: str | None


class RedisVectorStore:
    """
    Minimal Redis-backed vector store used for chat retrieval.
    - Keys
      * vs:doc:{doc_id} -> JSON meta {id, name, source}
      * vs:docs -> set of doc ids
      * vs:doc:{doc_id}:chunks -> list of chunk ids
      * vs:chunk:{chunk_id} -> JSON {document_id, cindex, text, metadata}
      * vs:emb:{chunk_id} -> JSON list of floats (embedding)
    """

    def __init__(self, settings: Settings):
        self._settings = settings
        self._r = self._client(settings)

    def _client(self, settings: Settings) -> redis.Redis:
        if settings.redis_url:
            return redis.Redis.from_url(settings.redis_url, decode_responses=True)
        return redis.Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            username=settings.redis_username or None,
            password=settings.redis_password or None,
            db=getattr(settings, "redis_db", 0),
            decode_responses=True,
        )

    # Key helpers
    def _k_doc(self, doc_id: str) -> str:
        return f"vs:doc:{doc_id}"

    def _k_docs(self) -> str:
        return "vs:docs"

    def _k_doc_chunks(self, doc_id: str) -> str:
        return f"vs:doc:{doc_id}:chunks"

    def _k_chunk(self, chunk_id: str) -> str:
        return f"vs:chunk:{chunk_id}"

    def _k_emb(self, chunk_id: str) -> str:
        return f"vs:emb:{chunk_id}"

    # Documents
    def set_document(self, document_id: str, name: str, source: Optional[str] = None) -> str:
        meta = {"id": document_id, "name": name, "source": source}
        pipe = self._r.pipeline(True)
        pipe.set(self._k_doc(document_id), json.dumps(meta))
        pipe.sadd(self._k_docs(), document_id)
        pipe.execute()
        return document_id

    def get_documents(self) -> List[Dict[str, Any]]:
        ids = list(self._r.smembers(self._k_docs()) or [])
        items: List[Dict[str, Any]] = []
        for did in ids:
            raw = self._r.get(self._k_doc(did))
            if not raw:
                continue
            try:
                meta = json.loads(raw)
                items.append({"document_id": meta.get("id", did), "name": meta.get("name"), "source": meta.get("source")})
            except Exception:
                continue
        return items

    def delete_document(self, document_id: str) -> None:
        # remove chunks + embeddings
        ck = self._k_doc_chunks(document_id)
        chunk_ids = list(self._r.lrange(ck, 0, -1) or [])
        pipe = self._r.pipeline(True)
        for cid in chunk_ids:
            pipe.delete(self._k_chunk(cid))
            pipe.delete(self._k_emb(cid))
        pipe.delete(ck)
        # remove doc meta/index
        pipe.delete(self._k_doc(document_id))
        pipe.srem(self._k_docs(), document_id)
        try:
            pipe.execute()
        except Exception:
            pass

    def document_exists(self, document_id: str) -> bool:
        return bool(self._r.exists(self._k_doc(document_id)))

    # Chunks & Embeddings
    def add_chunks_with_ids(
        self,
        document_id: str,
        chunk_ids: Sequence[str],
        texts: Sequence[str],
        metadatas: Optional[Sequence[Dict[str, Any]]] = None,
    ) -> List[str]:
        metadatas = metadatas or [{} for _ in texts]
        if len(chunk_ids) != len(texts):
            raise ValueError("chunk_ids and texts length mismatch")
        pipe = self._r.pipeline(True)
        for idx, (cid, txt, meta) in enumerate(zip(chunk_ids, texts, metadatas)):
            payload = {
                "document_id": document_id,
                "cindex": idx,
                "text": txt,
                "metadata": meta or {},
            }
            pipe.set(self._k_chunk(cid), json.dumps(payload, ensure_ascii=False))
            pipe.rpush(self._k_doc_chunks(document_id), cid)
        try:
            pipe.execute()
        except Exception:
            pass
        return list(chunk_ids)

    def upsert_embeddings(self, chunk_ids: Sequence[str], vectors: Sequence[np.ndarray]) -> None:
        if not chunk_ids:
            return
        pipe = self._r.pipeline(True)
        for cid, vec in zip(chunk_ids, vectors):
            # store as JSON array for readability/portability
            vec32 = vec.astype(np.float32, copy=False)
            pipe.set(self._k_emb(cid), json.dumps(vec32.tolist()))
        try:
            pipe.execute()
        except Exception:
            pass

    def _iter_candidate_chunks(self, allow_document_ids: Optional[Sequence[str]] = None):
        if allow_document_ids is not None:
            for did in allow_document_ids:
                for cid in self._r.lrange(self._k_doc_chunks(did), 0, -1) or []:
                    yield cid
        else:
            # all docs
            for did in self._r.smembers(self._k_docs()) or []:
                for cid in self._r.lrange(self._k_doc_chunks(did), 0, -1) or []:
                    yield cid

    def query_similar(self, query_vec: np.ndarray, top_k: int = 4, allow_document_ids: Optional[Sequence[str]] = None) -> List[Tuple[ChunkRecord, float]]:
        q = query_vec.astype(np.float32, copy=False)
        q_norm = float(np.linalg.norm(q)) or 1.0
        scored: List[Tuple[ChunkRecord, float]] = []
        # Brute-force scan; acceptable for small to medium datasets
        for cid in self._iter_candidate_chunks(allow_document_ids):
            raw_emb = self._r.get(self._k_emb(cid))
            raw_chunk = self._r.get(self._k_chunk(cid))
            if not raw_emb or not raw_chunk:
                continue
            try:
                emb = np.array(json.loads(raw_emb), dtype=np.float32)
                num = float(np.dot(q, emb))
                den = (q_norm * (float(np.linalg.norm(emb)) or 1.0))
                score = 0.0 if den == 0.0 else num / den
                data = json.loads(raw_chunk)
                meta = data.get("metadata") or {}
                if not isinstance(meta, dict):
                    try:
                        meta = dict(meta)
                    except Exception:
                        meta = {}
                # chunk record
                cr = ChunkRecord(
                    chunk_id=str(cid),
                    document_id=str(data.get("document_id")),
                    cindex=int(data.get("cindex", 0)),
                    text=str(data.get("text") or ""),
                    metadata=meta,
                )
                scored.append((cr, float(score)))
            except Exception:
                continue
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[: max(1, int(top_k))]

