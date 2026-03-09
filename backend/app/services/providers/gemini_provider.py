from __future__ import annotations
from typing import Iterable, List
import json
import numpy as np
from urllib import request, parse

from .base import ChatProvider, EmbeddingProvider, provider_error_from_exception


def _http_post(url: str, payload: dict, headers: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(url, data=data, headers={"Content-Type": "application/json", **headers}, method="POST")
    with request.urlopen(req, timeout=60) as resp:
        body = resp.read().decode("utf-8")
        return json.loads(body)


class GeminiChatProvider(ChatProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key

    def complete(
        self, messages: List[dict], model: str, temperature: float = 0.2, *, max_tokens: int | None = None, top_p: float | None = None, **_: dict
    ) -> str:
        # Convert OpenAI-style messages to Gemini contents
        contents = []
        for m in messages:
            role = "user" if m.get("role") == "user" else ("model" if m.get("role") == "assistant" else "user")
            contents.append({"role": role, "parts": [{"text": m.get("content", "")}]} )
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={parse.quote(self.api_key)}"
        gen: dict = {"temperature": temperature}
        if top_p is not None:
            gen["topP"] = float(top_p)
        if max_tokens is not None:
            gen["maxOutputTokens"] = int(max_tokens)
        payload = {"contents": contents, "generationConfig": gen}
        try:
            data = _http_post(url, payload, headers={})
            try:
                return data["candidates"][0]["content"]["parts"][0]["text"]
            except Exception:
                return data.get("output_text") or ""
        except Exception as e:
            raise provider_error_from_exception("gemini", e)


class GeminiEmbeddingProvider(EmbeddingProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key

    def embed_texts(self, texts: Iterable[str], model: str) -> List[np.ndarray]:
        arr = list(texts)
        if not arr:
            return []
        # Batch endpoint
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:batchEmbedText?key={parse.quote(self.api_key)}"
        payload = {"texts": arr}
        try:
            data = _http_post(url, payload, headers={})
            out: List[np.ndarray] = []
            embeddings = data.get("embeddings") or data.get("embeddingsList") or []
            for emb in embeddings:
                vec = emb.get("values") or emb.get("value") or emb.get("embedding", {}).get("values")
                if vec is None:
                    vec = []
                out.append(np.array(vec, dtype=np.float32))
            return out
        except Exception as e:
            raise provider_error_from_exception("gemini", e)
