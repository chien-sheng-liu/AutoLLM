from __future__ import annotations

import json
import threading
from time import time as _time
from typing import Any, List
from uuid import uuid4

import redis

from ..config import Settings

ALLOWED_ROLES = {"system", "user", "assistant"}


class ConversationStore:
    def __init__(self, settings: Settings):
        self._client = self._build_client(settings)
        self._key_prefix = "chat:conversations"

    def _build_client(self, settings: Settings) -> redis.Redis:
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

    def _key(self, user_id: str) -> str:
        return f"{self._key_prefix}:{user_id}"

    def get_conversations(self, user_id: str) -> List[dict[str, Any]]:
        raw = self._client.get(self._key(user_id))
        if not raw:
            return []
        try:
            data = json.loads(raw)
        except Exception:
            return []
        if isinstance(data, dict):
            owner = data.get("user_id")
            if owner and owner != user_id:
                return []
            items = data.get("items", [])
            return items if isinstance(items, list) else []
        if isinstance(data, list):
            # Legacy format (no owner metadata)
            return data
        return []

    def save_conversations(self, user_id: str, conversations: List[dict[str, Any]]) -> None:
        sanitized: List[dict[str, Any]] = []
        for conv in conversations or []:
            if not isinstance(conv, dict):
                continue
            conv_id = str(conv.get("id") or uuid4())
            title = str(conv.get("title") or "新的對話").strip() or "新的對話"
            default_ts = int(conv.get("updatedAt") or conv.get("updated_at") or conv.get("createdAt") or conv.get("created_at") or int(_time() * 1000))
            created_at = int(conv.get("createdAt") or conv.get("created_at") or default_ts)
            updated_at = int(conv.get("updatedAt") or conv.get("updated_at") or default_ts)
            messages = []
            raw_msgs = conv.get("messages")
            if isinstance(raw_msgs, list):
                for msg in raw_msgs:
                    if not isinstance(msg, dict):
                        continue
                    role = str(msg.get("role") or "assistant").lower()
                    if role not in ALLOWED_ROLES:
                        role = "assistant"
                    content = str(msg.get("content") or "")
                    if not content:
                        continue
                    messages.append({"role": role, "content": content})
            sanitized.append(
                {
                    "id": conv_id,
                    "title": title,
                    "messages": messages,
                    "createdAt": created_at,
                    "updatedAt": updated_at,
                }
            )
        payload = {"user_id": user_id, "items": sanitized}
        self._client.set(self._key(user_id), json.dumps(payload))

    def clear(self, user_id: str) -> None:
        self._client.delete(self._key(user_id))


_store: ConversationStore | None = None
_store_lock = threading.Lock()


def get_conversation_store(settings: Settings) -> ConversationStore:
    global _store
    with _store_lock:
        if _store is None:
            _store = ConversationStore(settings)
    return _store
