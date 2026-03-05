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
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            conn.commit()

    def list_users(self) -> List[UserRecord]:
        with self._connect() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    "SELECT id::text AS id, email, name, hashed_password, created_at FROM users ORDER BY created_at DESC"
                )
                rows = cur.fetchall()
        return [cast(UserRecord, dict(row)) for row in rows]

    def get_by_email(self, email: str) -> Optional[UserRecord]:
        normalized = email.strip().lower()
        with self._connect() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    "SELECT id::text AS id, email, name, hashed_password, created_at FROM users WHERE lower(email) = %s LIMIT 1",
                    (normalized,),
                )
                row = cur.fetchone()
        return cast(UserRecord, dict(row)) if row else None

    def get_by_id(self, user_id: str) -> Optional[UserRecord]:
        with self._connect() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    "SELECT id::text AS id, email, name, hashed_password, created_at FROM users WHERE id = %s LIMIT 1",
                    (user_id,),
                )
                row = cur.fetchone()
        return cast(UserRecord, dict(row)) if row else None

    def create_user(self, email: str, hashed_password: str, name: str | None = None) -> UserRecord:
        normalized = email.strip().lower()
        display_name = name.strip() if name else None
        user_id = str(uuid4())
        with self._connect() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                try:
                    cur.execute(
                        """
                        INSERT INTO users (id, email, name, hashed_password)
                        VALUES (%s, %s, %s, %s)
                        RETURNING id::text AS id, email, name, hashed_password, created_at
                        """,
                        (user_id, normalized, display_name, hashed_password),
                    )
                except errors.UniqueViolation as exc:
                    conn.rollback()
                    raise ValueError("email already registered") from exc
                row = cur.fetchone()
                conn.commit()
        return cast(UserRecord, dict(row))


_store: UserStore | None = None
_store_lock = threading.Lock()


def get_user_store(settings: Settings) -> UserStore:
    global _store
    with _store_lock:
        if _store is None:
            _store = UserStore(settings)
    return _store
