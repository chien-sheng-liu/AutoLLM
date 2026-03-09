from __future__ import annotations
from typing import Iterable, List, Generator, Optional
from urllib.error import HTTPError
import numpy as np


class ProviderError(Exception):
    def __init__(self, provider: str, code: str, message: str, *, cause: Optional[BaseException] = None):
        super().__init__(message)
        self.provider = provider
        self.code = code
        self.message = message
        self.__cause__ = cause

    def to_dict(self) -> dict:
        return {"error": "provider_error", "provider": self.provider, "code": self.code, "message": self.message}


def _classify_status(status: int) -> str:
    if status == 401:
        return "unauthorized"
    if status == 403:
        return "forbidden"
    if status == 408:
        return "timeout"
    if status == 429:
        return "rate_limited"
    if status == 503:
        return "service_unavailable"
    if 500 <= status <= 599:
        return "server_error"
    if 400 <= status <= 499:
        return "bad_request"
    return "unknown_error"


def provider_error_from_exception(provider: str, err: BaseException) -> ProviderError:
    # Try to extract HTTP status from common exception types without importing provider SDKs
    status: Optional[int] = None
    message = str(err)
    # urllib HTTPError
    if isinstance(err, HTTPError):
        try:
            status = int(getattr(err, "code", None))
        except Exception:
            status = None
    # openai>=1.x APIStatusError exposes status_code
    if status is None and hasattr(err, "status_code"):
        try:
            status = int(getattr(err, "status_code"))  # type: ignore[arg-type]
        except Exception:
            status = None
    # Fallback by message
    code = "unknown_error"
    if status is not None:
        code = _classify_status(status)
    else:
        low = message.lower()
        if "timeout" in low:
            code = "timeout"
        elif "rate limit" in low or "too many requests" in low:
            code = "rate_limited"
        elif "unauthorized" in low or "invalid api key" in low:
            code = "unauthorized"
        elif "forbidden" in low or "permission" in low:
            code = "forbidden"
        elif "service unavailable" in low:
            code = "service_unavailable"
        elif "connection" in low or "network" in low:
            code = "network_error"
    return ProviderError(provider, code, message, cause=err)


class ChatProvider:
    def complete(self, messages: List[dict], model: str, temperature: float = 0.2) -> str:
        raise NotImplementedError

    def stream(self, messages: List[dict], model: str, temperature: float = 0.2) -> Generator[str, None, None]:
        # Default non-streaming fallback: chunk the full completion to simulate streaming
        text = self.complete(messages, model, temperature)
        step = 40
        for i in range(0, len(text), step):
            yield text[i : i + step]


class EmbeddingProvider:
    def embed_texts(self, texts: Iterable[str], model: str) -> List[np.ndarray]:
        raise NotImplementedError
