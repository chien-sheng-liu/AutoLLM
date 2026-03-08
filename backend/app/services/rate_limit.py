from __future__ import annotations

import time

import redis
from fastapi import HTTPException, status

from ..config import Settings


def _redis_client(settings: Settings) -> redis.Redis:
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


def check_rate_limit(settings: Settings, user_id: str, scope: str, limit: int, window_seconds: int) -> None:
    r = _redis_client(settings)
    bucket = int(time.time() // window_seconds)
    key = f"rate:{scope}:{user_id}:{bucket}"
    try:
        count = r.incr(key)
        if count == 1:
            r.expire(key, window_seconds)
        if count > limit:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded")
    except redis.RedisError:
        # Fail-open on Redis issues; do not block
        return

