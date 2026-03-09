from __future__ import annotations

import threading
from datetime import datetime
from typing import List, Optional, TypedDict, cast
from uuid import uuid4

import psycopg
from psycopg import errors
from psycopg.rows import dict_row

from ..config import Settings


class UserRecord(TypedDict):
    id: str
    email: str
    name: str | None
    hashed_password: str
    role: str | None
    auth: str | None
    created_at: datetime


class UserStore:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._conn_kwargs = {
            "host": settings.postgres_host,
            "port": settings.postgres_port,
            "user": settings.postgres_user,
            "password": settings.postgres_password,
            "dbname": settings.postgres_db,
        }
        self._lock = threading.Lock()
        self._ensure_table()

    def _connect(self):
        return psycopg.connect(**self._conn_kwargs)

    def _ensure_table(self) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id UUID PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    name TEXT,
                    hashed_password TEXT NOT NULL,
                    auth TEXT NOT NULL DEFAULT 'user',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            # Ensure auth exists and normalized
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS auth TEXT")
            cur.execute("ALTER TABLE users ALTER COLUMN auth SET DEFAULT 'user'")
            cur.execute("UPDATE users SET auth = 'user' WHERE auth IS NULL")
            cur.execute("ALTER TABLE users ALTER COLUMN auth SET NOT NULL")
            # Permission mapping: which documents a user can access (optional; empty = all)
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS user_doc_perms (
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                    PRIMARY KEY (user_id, document_id)
                )
                """
            )
            conn.commit()

    def list_users(self) -> List[UserRecord]:
        with self._connect() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    "SELECT id::text AS id, email, name, hashed_password, auth, created_at FROM users ORDER BY created_at DESC"
                )
                rows = cur.fetchall()
        return [cast(UserRecord, dict(row)) for row in rows]

    def count_users(self) -> int:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT COUNT(1) FROM users")
            (cnt,) = cur.fetchone()
            return int(cnt)

    def any_admin_exists(self) -> bool:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT 1 FROM users WHERE lower(auth) IN ('admin','administrator') LIMIT 1")
            return cur.fetchone() is not None

    def get_by_email(self, email: str) -> Optional[UserRecord]:
        normalized = email.strip().lower()
        with self._connect() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    "SELECT id::text AS id, email, name, hashed_password, auth, created_at FROM users WHERE lower(email) = %s LIMIT 1",
                    (normalized,),
                )
                row = cur.fetchone()
        return cast(UserRecord, dict(row)) if row else None

    def get_by_id(self, user_id: str) -> Optional[UserRecord]:
        with self._connect() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    "SELECT id::text AS id, email, name, hashed_password, auth, created_at FROM users WHERE id = %s LIMIT 1",
                    (user_id,),
                )
                row = cur.fetchone()
        return cast(UserRecord, dict(row)) if row else None

    def create_user(self, email: str, hashed_password: str, name: str | None = None, auth: str | None = None) -> UserRecord:
        normalized = email.strip().lower()
        display_name = name.strip() if name else None
        user_id = str(uuid4())
        # Derive final auth/role
        auth_final = (auth or '').strip().lower()
        # normalize synonyms
        if auth_final == 'administrator':
            auth_final = 'admin'
        if auth_final not in ('admin', 'manager', 'user', ''):
            auth_final = 'user'
        with self._connect() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                try:
                    cur.execute(
                        """
                        INSERT INTO users (id, email, name, hashed_password, auth)
                        VALUES (%s, %s, %s, %s, %s)
                        RETURNING id::text AS id, email, name, hashed_password, auth, created_at
                        """,
                        (user_id, normalized, display_name, hashed_password, auth_final or 'user'),
                    )
                except errors.UniqueViolation as exc:
                    conn.rollback()
                    raise ValueError("email already registered") from exc
                row = cur.fetchone()
                conn.commit()
        return cast(UserRecord, dict(row))

    # Roles
    def set_auth(self, user_id: str, auth: str) -> None:
        auth_norm = auth.strip().lower()
        # normalize aliases
        if auth_norm == 'administrator':
            auth_norm = 'admin'
        if auth_norm not in ("admin", "manager", "user"):
            raise ValueError("invalid auth")
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute("UPDATE users SET auth = %s WHERE id = %s", (auth_norm, user_id))
            conn.commit()

    # Document permissions
    def get_user_allowed_docs(self, user_id: str) -> list[str]:
        with self._connect() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "SELECT document_id::text AS id FROM user_doc_perms WHERE user_id = %s",
                (user_id,),
            )
            rows = cur.fetchall()
        return [str(r["id"]) for r in rows]

    def set_user_allowed_docs(self, user_id: str, doc_ids: list[str]) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute("DELETE FROM user_doc_perms WHERE user_id = %s", (user_id,))
            for did in doc_ids:
                cur.execute(
                    "INSERT INTO user_doc_perms (user_id, document_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                    (user_id, did),
                )
            conn.commit()

    def get_doc_allowed_users(self, document_id: str) -> list[str]:
        with self._connect() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "SELECT user_id::text AS uid FROM user_doc_perms WHERE document_id = %s",
                (document_id,),
            )
            rows = cur.fetchall()
        return [str(r["uid"]) for r in rows]

    def set_doc_allowed_users(self, document_id: str, user_ids: list[str]) -> None:
        unique_ids = list(dict.fromkeys(user_ids))
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute("DELETE FROM user_doc_perms WHERE document_id = %s", (document_id,))
            for uid in unique_ids:
                cur.execute(
                    "INSERT INTO user_doc_perms (user_id, document_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                    (uid, document_id),
                )
            conn.commit()

    # Password management
    def update_password(self, user_id: str, new_hashed_password: str) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute("UPDATE users SET hashed_password = %s WHERE id = %s", (new_hashed_password, user_id))
            conn.commit()


_store: UserStore | None = None
_store_lock = threading.Lock()


def get_user_store(settings: Settings) -> UserStore:
    global _store
    with _store_lock:
        if _store is None:
            _store = UserStore(settings)
    return _store
