from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Optional, List, TypedDict, Any
from uuid import uuid4

import psycopg
from psycopg.rows import dict_row

from ..config import Settings


class ConversationRow(TypedDict):
    id: str
    user_id: str
    title: str
    created_at: str
    updated_at: str
    series: int


class _MessageRowRequired(TypedDict):
    id: str
    conversation_id: str
    user_id: str
    role: str
    content: str
    created_at: str


class MessageRow(_MessageRowRequired, total=False):
    citations: Any  # list[dict] | None


@dataclass
class ConversationPgStore:
    settings: Settings

    def __post_init__(self) -> None:
        self._conn_kwargs = {
            "host": self.settings.postgres_host,
            "port": self.settings.postgres_port,
            "user": self.settings.postgres_user,
            "password": self.settings.postgres_password,
            "dbname": self.settings.postgres_db,
        }
        self._ensure_tables()

    def _connect(self):
        return psycopg.connect(**self._conn_kwargs)

    def _ensure_tables(self) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            # Ensure series sequence exists
            try:
                cur.execute("CREATE SEQUENCE IF NOT EXISTS conversation_series_seq")
            except Exception:
                pass
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS conversations (
                    id UUID PRIMARY KEY,
                    user_id UUID NOT NULL,
                    title TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    series BIGINT UNIQUE DEFAULT nextval('conversation_series_seq')
                )
                """
            )
            # Ensure series column exists + default + backfill for existing rows
            try:
                cur.execute("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS series BIGINT")
            except Exception:
                pass
            try:
                cur.execute("ALTER TABLE conversations ALTER COLUMN series SET DEFAULT nextval('conversation_series_seq')")
            except Exception:
                pass
            try:
                cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_series ON conversations(series)")
            except Exception:
                pass
            try:
                cur.execute("UPDATE conversations SET series = nextval('conversation_series_seq') WHERE series IS NULL")
            except Exception:
                pass
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS conversation_messages (
                    id UUID PRIMARY KEY,
                    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                    user_id UUID NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            # Migrate existing tables: add new columns if not present
            try:
                cur.execute("ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS citations JSONB DEFAULT NULL")
            except Exception:
                pass
            try:
                cur.execute("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS document_ids JSONB DEFAULT NULL")
            except Exception:
                pass
            cur.execute("CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_messages_conv ON conversation_messages(conversation_id, created_at)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_messages_user ON conversation_messages(user_id)")
            # Enable RLS and policies (idempotent)
            try:
                cur.execute("ALTER TABLE conversations ENABLE ROW LEVEL SECURITY")
                cur.execute("ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY")
                cur.execute(
                    """
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'conversations' AND policyname = 'conversations_owner'
                        ) THEN
                            EXECUTE 'CREATE POLICY conversations_owner ON conversations USING (user_id = current_setting(''app.user_id'', true)::uuid)';
                        END IF;
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'conversation_messages' AND policyname = 'conversation_messages_owner'
                        ) THEN
                            EXECUTE 'CREATE POLICY conversation_messages_owner ON conversation_messages USING (user_id = current_setting(''app.user_id'', true)::uuid)';
                        END IF;
                    END$$;
                    """
                )
            except Exception:
                pass
            conn.commit()

    def get_or_create_conversation(self, *, user_id: str, conversation_id: Optional[str], title: Optional[str]) -> ConversationRow:
        with self._connect() as conn, conn.cursor(row_factory=dict_row) as cur:
            try:
                cur.execute("SET LOCAL app.user_id = %s", (user_id,))
            except Exception:
                try: conn.rollback()
                except Exception: pass
            if conversation_id:
                cur.execute(
                    "SELECT id::text AS id, user_id::text AS user_id, COALESCE(title,'') AS title, created_at::text, updated_at::text, series FROM conversations WHERE id=%s AND user_id=%s",
                    (conversation_id, user_id),
                )
                row = cur.fetchone()
                if row:
                    return row  # type: ignore
                conversation_id = None
            # create
            cid = conversation_id or str(uuid4())
            conv_title = (title or "新的對話").strip() or "新的對話"
            cur.execute(
                """
                INSERT INTO conversations (id, user_id, title)
                VALUES (%s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                RETURNING id::text AS id, user_id::text AS user_id, title, created_at::text, updated_at::text, series
                """,
                (cid, user_id, conv_title),
            )
            row = cur.fetchone()
            if not row:
                # race: fetch existing
                cur.execute(
                    "SELECT id::text AS id, user_id::text AS user_id, COALESCE(title,'') AS title, created_at::text, updated_at::text, series FROM conversations WHERE id=%s AND user_id=%s",
                    (cid, user_id),
                )
                row = cur.fetchone()
            conn.commit()
            return row  # type: ignore

    def append_message(self, *, user_id: str, conversation_id: str, role: str, content: str, citations: list | None = None) -> str:
        mid = str(uuid4())
        citations_json = json.dumps(citations, ensure_ascii=False) if citations else None
        with self._connect() as conn, conn.cursor() as cur:
            try:
                cur.execute("SET LOCAL app.user_id = %s", (user_id,))
            except Exception:
                try: conn.rollback()
                except Exception: pass
            cur.execute(
                """
                INSERT INTO conversation_messages (id, conversation_id, user_id, role, content, citations)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (mid, conversation_id, user_id, role, content, citations_json),
            )
            cur.execute("UPDATE conversations SET updated_at = NOW() WHERE id = %s", (conversation_id,))
            conn.commit()
        return mid

    def list_conversations(self, *, user_id: str) -> list[ConversationRow]:
        with self._connect() as conn, conn.cursor(row_factory=dict_row) as cur:
            try:
                cur.execute("SET LOCAL app.user_id = %s", (user_id,))
            except Exception:
                try: conn.rollback()
                except Exception: pass
            cur.execute(
                """
                SELECT id::text AS id, user_id::text AS user_id, title,
                       created_at::text, updated_at::text
                FROM conversations
                WHERE user_id = %s
                ORDER BY updated_at DESC
                """,
                (user_id,),
            )
            rows = cur.fetchall()
            return [row for row in rows]  # type: ignore

    def get_messages(self, *, user_id: str, conversation_id: str) -> list[MessageRow]:
        with self._connect() as conn, conn.cursor(row_factory=dict_row) as cur:
            try:
                cur.execute("SET LOCAL app.user_id = %s", (user_id,))
            except Exception:
                try: conn.rollback()
                except Exception: pass
            # ownership check
            cur.execute("SELECT 1 FROM conversations WHERE id=%s AND user_id=%s", (conversation_id, user_id))
            if cur.fetchone() is None:
                return []
            cur.execute(
                """
                SELECT id::text AS id, conversation_id::text AS conversation_id,
                       user_id::text AS user_id, role, content, created_at::text,
                       citations
                FROM conversation_messages
                WHERE conversation_id = %s
                ORDER BY created_at ASC
                """,
                (conversation_id,),
            )
            rows = cur.fetchall()
            result = []
            for row in rows:
                d = dict(row)
                # citations stored as JSONB comes back as list/dict already, or as str
                raw_cit = d.get("citations")
                if isinstance(raw_cit, str):
                    try:
                        d["citations"] = json.loads(raw_cit)
                    except Exception:
                        d["citations"] = None
                result.append(d)
            return result  # type: ignore

    def create_conversation(self, *, user_id: str, title: str) -> ConversationRow:
        with self._connect() as conn, conn.cursor(row_factory=dict_row) as cur:
            try:
                cur.execute("SET LOCAL app.user_id = %s", (user_id,))
            except Exception:
                try: conn.rollback()
                except Exception: pass
            cid = str(uuid4())
            conv_title = (title or "新的對話").strip() or "新的對話"
            cur.execute(
                """
                INSERT INTO conversations (id, user_id, title)
                VALUES (%s, %s, %s)
                RETURNING id::text AS id, user_id::text AS user_id, title, created_at::text, updated_at::text, series
                """,
                (cid, user_id, conv_title),
            )
            row = cur.fetchone()
            conn.commit()
            return row  # type: ignore

    def rename_conversation(self, *, user_id: str, conversation_id: str, title: str) -> Optional[ConversationRow]:
        with self._connect() as conn, conn.cursor(row_factory=dict_row) as cur:
            try:
                cur.execute("SET LOCAL app.user_id = %s", (user_id,))
            except Exception:
                try:
                    conn.rollback()
                except Exception:
                    pass
            cur.execute("UPDATE conversations SET title=%s, updated_at=NOW() WHERE id=%s AND user_id=%s RETURNING id::text AS id, user_id::text AS user_id, title, created_at::text, updated_at::text, series", (title, conversation_id, user_id))
            row = cur.fetchone()
            conn.commit()
            return row  # type: ignore

    def delete_conversation(self, *, user_id: str, conversation_id: str) -> bool:
        with self._connect() as conn, conn.cursor() as cur:
            try:
                cur.execute("SET LOCAL app.user_id = %s", (user_id,))
            except Exception:
                try:
                    conn.rollback()
                except Exception:
                    pass
            cur.execute("DELETE FROM conversations WHERE id=%s AND user_id=%s", (conversation_id, user_id))
            deleted = cur.rowcount > 0
            conn.commit()
            return deleted

    def get_document_scope(self, *, user_id: str, conversation_id: str) -> list[str] | None:
        """Return the user-selected document IDs for this conversation, or None (= all docs)."""
        with self._connect() as conn, conn.cursor(row_factory=dict_row) as cur:
            try:
                cur.execute("SET LOCAL app.user_id = %s", (user_id,))
            except Exception:
                try: conn.rollback()
                except Exception: pass
            cur.execute(
                "SELECT document_ids FROM conversations WHERE id=%s AND user_id=%s",
                (conversation_id, user_id),
            )
            row = cur.fetchone()
            if row is None:
                return None
            raw = row.get("document_ids")
            if raw is None:
                return None
            if isinstance(raw, str):
                try:
                    raw = json.loads(raw)
                except Exception:
                    return None
            if isinstance(raw, list):
                return [str(x) for x in raw]
            return None

    def set_document_scope(self, *, user_id: str, conversation_id: str, document_ids: list[str] | None) -> bool:
        """Persist the document scope for a conversation. Pass None to clear (= all docs)."""
        scope_json = json.dumps(document_ids, ensure_ascii=False) if document_ids is not None else None
        with self._connect() as conn, conn.cursor() as cur:
            try:
                cur.execute("SET LOCAL app.user_id = %s", (user_id,))
            except Exception:
                try: conn.rollback()
                except Exception: pass
            cur.execute(
                "UPDATE conversations SET document_ids=%s WHERE id=%s AND user_id=%s",
                (scope_json, conversation_id, user_id),
            )
            updated = cur.rowcount > 0
            conn.commit()
            return updated


_pg_store: ConversationPgStore | None = None


def get_conv_pg_store(settings: Settings) -> ConversationPgStore:
    global _pg_store
    if _pg_store is None:
        _pg_store = ConversationPgStore(settings)
    return _pg_store
