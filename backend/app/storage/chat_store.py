from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional
from uuid import uuid4

import psycopg
from psycopg.rows import dict_row

from ..config import Settings


@dataclass
class ChatMessageRecord:
    id: str
    user_id: str
    question: str
    answer: str
    citations: list[dict[str, Any]]
    used_prompt: Optional[str]
    created_at: datetime


class ChatStore:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._conn_kwargs = {
            "host": settings.postgres_host,
            "port": settings.postgres_port,
            "user": settings.postgres_user,
            "password": settings.postgres_password,
            "dbname": settings.postgres_db,
        }
        self._ensure_tables()

    def _connect(self):
        return psycopg.connect(**self._conn_kwargs)

    def _ensure_tables(self) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id UUID PRIMARY KEY,
                    user_id UUID NOT NULL,
                    question TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    citations JSONB,
                    used_prompt TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS feedback (
                    id UUID PRIMARY KEY,
                    user_id UUID NOT NULL,
                    answer_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
                    vote SMALLINT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute("CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id)")
            conn.commit()

    def insert_chat_message(
        self,
        *,
        user_id: str,
        question: str,
        answer: str,
        citations: list[dict[str, Any]] | None,
        used_prompt: str | None,
    ) -> str:
        mid = str(uuid4())
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO chat_messages (id, user_id, question, answer, citations, used_prompt)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (mid, user_id, question, answer, json.dumps(citations or []), used_prompt),
            )
            conn.commit()
        return mid

    def add_feedback(self, *, user_id: str, answer_id: str, vote: int) -> str:
        fid = str(uuid4())
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO feedback (id, user_id, answer_id, vote)
                VALUES (%s, %s, %s, %s)
                """,
                (fid, user_id, answer_id, vote),
            )
            conn.commit()
        return fid


_store: ChatStore | None = None


def get_chat_store(settings: Settings) -> ChatStore:
    global _store
    if _store is None:
        _store = ChatStore(settings)
    return _store

