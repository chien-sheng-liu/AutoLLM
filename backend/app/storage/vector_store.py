from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple
from uuid import uuid4

import numpy as np
import psycopg
from psycopg.rows import dict_row

from ..config import Settings


@dataclass
class ChunkRecord:
    chunk_id: str
    document_id: str
    cindex: int
    text: str
    metadata: Dict[str, Any]


class VectorStore:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._conn_kwargs = {
            "host": settings.postgres_host,
            "port": settings.postgres_port,
            "user": settings.postgres_user,
            "password": settings.postgres_password,
            "dbname": settings.postgres_db,
        }
        self._ensure_schema()

    def _connect(self):
        return psycopg.connect(**self._conn_kwargs)

    def _ensure_schema(self) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS documents (
                    id UUID PRIMARY KEY,
                    name TEXT NOT NULL,
                    source TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS chunks (
                    id UUID PRIMARY KEY,
                    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                    cindex INTEGER NOT NULL,
                    text TEXT NOT NULL,
                    metadata JSONB
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS embeddings (
                    chunk_id UUID PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
                    embedding vector
                )
                """
            )
            cur.execute("CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(document_id)")
            conn.commit()

    # Documents
    def add_document(self, name: str, source: Optional[str] = None) -> str:
        doc_id = str(uuid4())
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "INSERT INTO documents (id, name, source) VALUES (%s, %s, %s)",
                (doc_id, name, source),
            )
            conn.commit()
        return doc_id

    def get_documents(self) -> List[Dict[str, Any]]:
        with self._connect() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT id::text AS id, name, source FROM documents ORDER BY created_at DESC")
            rows = cur.fetchall()
        return [{"document_id": str(row["id"]), "name": row["name"], "source": row["source"]} for row in rows]

    def delete_document(self, document_id: str) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute("DELETE FROM documents WHERE id = %s", (document_id,))
            conn.commit()

    # Chunks & Embeddings
    def add_chunks(
        self,
        document_id: str,
        texts: Sequence[str],
        metadatas: Optional[Sequence[Dict[str, Any]]] = None,
    ) -> List[str]:
        chunk_ids: List[str] = []
        metadatas = metadatas or [{} for _ in texts]
        with self._connect() as conn, conn.cursor() as cur:
            for idx, (txt, meta) in enumerate(zip(texts, metadatas)):
                cid = str(uuid4())
                cur.execute(
                    """
                    INSERT INTO chunks (id, document_id, cindex, text, metadata)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (cid, document_id, idx, txt, json.dumps(meta, ensure_ascii=False)),
                )
                chunk_ids.append(cid)
            conn.commit()
        return chunk_ids

    def upsert_embeddings(self, chunk_ids: Sequence[str], vectors: Sequence[np.ndarray]) -> None:
        if not chunk_ids:
            return
        with self._connect() as conn, conn.cursor() as cur:
            for cid, vec in zip(chunk_ids, vectors):
                vec32 = vec.astype(np.float32, copy=False)
                cur.execute(
                    """
                    INSERT INTO embeddings (chunk_id, embedding)
                    VALUES (%s, %s::vector)
                    ON CONFLICT (chunk_id)
                    DO UPDATE SET embedding = EXCLUDED.embedding
                    """,
                    (cid, self._format_vector_literal(vec32)),
                )
            conn.commit()

    def query_similar(self, query_vec: np.ndarray, top_k: int = 4) -> List[Tuple[ChunkRecord, float]]:
        qvec = query_vec.astype(np.float32, copy=False)
        literal = self._format_vector_literal(qvec)
        with self._connect() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT c.id::text AS id,
                       c.document_id::text AS document_id,
                       d.name,
                       c.cindex,
                       c.text,
                       c.metadata,
                       1 - (e.embedding <=> %s::vector) AS score
                FROM embeddings e
                JOIN chunks c ON c.id = e.chunk_id
                JOIN documents d ON d.id = c.document_id
                ORDER BY e.embedding <=> %s::vector
                LIMIT %s
                """,
                (literal, literal, top_k),
            )
            rows = cur.fetchall()
        results: List[Tuple[ChunkRecord, float]] = []
        for row in rows:
            metadata = row["metadata"] or {}
            if isinstance(metadata, str):
                metadata = json.loads(metadata)
            metadata = dict(metadata)
            metadata.setdefault("name", row["name"])
            cr = ChunkRecord(
                chunk_id=row["id"],
                document_id=row["document_id"],
                cindex=row["cindex"],
                text=row["text"],
                metadata=metadata,
            )
            results.append((cr, float(row["score"])) )
        return results

    def _format_vector_literal(self, vec: np.ndarray) -> str:
        values = ",".join(f"{float(x):.6f}" for x in vec.tolist())
        return f"[{values}]"
