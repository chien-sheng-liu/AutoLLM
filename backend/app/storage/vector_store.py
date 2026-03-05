import json
import os
import sqlite3
import uuid
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np


@dataclass
class ChunkRecord:
    chunk_id: str
    document_id: str
    cindex: int
    text: str
    metadata: Dict[str, Any]


def _serialize_vector(vec: np.ndarray) -> bytes:
    assert vec.dtype == np.float32
    return vec.tobytes(order="C")


def _deserialize_vector(blob: bytes, dim: int) -> np.ndarray:
    arr = np.frombuffer(blob, dtype=np.float32)
    if dim and arr.size != dim:
        # In case of mismatch, best effort slice
        arr = arr[:dim]
    return arr


class VectorStore:
    def __init__(self, db_path: str):
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.db_path = db_path
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.execute("PRAGMA journal_mode=WAL;")
        self._ensure_schema()

    def _ensure_schema(self) -> None:
        cur = self.conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS documents (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              source TEXT,
              created_at TEXT DEFAULT (datetime('now'))
            );
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS chunks (
              id TEXT PRIMARY KEY,
              document_id TEXT NOT NULL,
              cindex INTEGER NOT NULL,
              text TEXT NOT NULL,
              metadata TEXT,
              FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
            );
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS embeddings (
              chunk_id TEXT PRIMARY KEY,
              vector BLOB NOT NULL,
              FOREIGN KEY(chunk_id) REFERENCES chunks(id) ON DELETE CASCADE
            );
            """
        )
        cur.execute("CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(document_id);")
        self.conn.commit()

    # Documents
    def add_document(self, name: str, source: Optional[str] = None) -> str:
        doc_id = str(uuid.uuid4())
        self.conn.execute(
            "INSERT INTO documents (id, name, source) VALUES (?, ?, ?)", (doc_id, name, source)
        )
        self.conn.commit()
        return doc_id

    def get_documents(self) -> List[Dict[str, Any]]:
        rows = self.conn.execute("SELECT id, name, source FROM documents ORDER BY created_at DESC").fetchall()
        return [{"document_id": r[0], "name": r[1], "source": r[2]} for r in rows]

    def delete_document(self, document_id: str) -> None:
        self.conn.execute("DELETE FROM documents WHERE id = ?", (document_id,))
        self.conn.execute("DELETE FROM chunks WHERE document_id = ?", (document_id,))
        # embeddings will cascade via chunk deletion; but enforce anyway
        self.conn.execute(
            "DELETE FROM embeddings WHERE chunk_id IN (SELECT id FROM chunks WHERE document_id = ?)",
            (document_id,),
        )
        self.conn.commit()

    # Chunks & Embeddings
    def add_chunks(self, document_id: str, texts: Sequence[str], metadatas: Optional[Sequence[Dict[str, Any]]] = None) -> List[str]:
        chunk_ids: List[str] = []
        metadatas = metadatas or [{} for _ in texts]
        cur = self.conn.cursor()
        for idx, (txt, meta) in enumerate(zip(texts, metadatas)):
            cid = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO chunks (id, document_id, cindex, text, metadata) VALUES (?, ?, ?, ?, ?)",
                (cid, document_id, idx, txt, json.dumps(meta, ensure_ascii=False)),
            )
            chunk_ids.append(cid)
        self.conn.commit()
        return chunk_ids

    def upsert_embeddings(self, chunk_ids: Sequence[str], vectors: Sequence[np.ndarray]) -> None:
        cur = self.conn.cursor()
        for cid, vec in zip(chunk_ids, vectors):
            vec32 = vec.astype(np.float32, copy=False)
            cur.execute(
                "REPLACE INTO embeddings (chunk_id, vector) VALUES (?, ?)",
                (cid, _serialize_vector(vec32)),
            )
        self.conn.commit()

    def _fetch_all_embeddings(self) -> List[Tuple[str, str, str, int, str, Optional[str], bytes]]:
        # Returns (chunk_id, document_id, name, cindex, text, metadata, vector)
        sql = (
            "SELECT c.id, c.document_id, d.name, c.cindex, c.text, c.metadata, e.vector "
            "FROM chunks c JOIN embeddings e ON c.id = e.chunk_id "
            "JOIN documents d ON d.id = c.document_id"
        )
        return list(self.conn.execute(sql).fetchall())

    def query_similar(self, query_vec: np.ndarray, top_k: int = 4) -> List[Tuple[ChunkRecord, float]]:
        rows = self._fetch_all_embeddings()
        if not rows:
            return []
        q = query_vec.astype(np.float32)
        # Normalize for cosine similarity
        qn = q / (np.linalg.norm(q) + 1e-10)
        scores: List[Tuple[ChunkRecord, float]] = []
        dim = q.shape[0]
        for cid, doc_id, name, cindex, text, metadata, blob in rows:
            v = _deserialize_vector(blob, dim)
            vn = v / (np.linalg.norm(v) + 1e-10)
            score = float(np.dot(qn, vn))
            meta_dict = json.loads(metadata) if metadata else {}
            cr = ChunkRecord(chunk_id=cid, document_id=doc_id, cindex=cindex, text=text, metadata=meta_dict | {"name": name})
            scores.append((cr, score))
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]

