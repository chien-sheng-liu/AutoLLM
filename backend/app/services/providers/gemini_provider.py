from __future__ import annotations
from typing import Iterable, List
import json
import numpy as np
from urllib import request, parse

from .base import ChatProvider, EmbeddingProvider


def _http_post(url: str, payload: dict, headers: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(url, data=data, headers={"Content-Type": "application/json", **headers}, method="POST")
    with request.urlopen(req, timeout=60) as resp:
        body = resp.read().decode("utf-8")
        return json.loads(body)


class GeminiChatProvider(ChatProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key

    def complete(self, messages: List[dict], model: str, temperature: float = 0.2) -> str:
        # Convert OpenAI-style messages to Gemini contents
        contents = []
        for m in messages:
            role = "user" if m.get("role") == "user" else ("model" if m.get("role") == "assistant" else "user")
            contents.append({"role": role, "parts": [{"text": m.get("content", "")}]} )
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={parse.quote(self.api_key)}"
        payload = {
            "contents": contents,
            "generationConfig": {"temperature": temperature},
        }
        data = _http_post(url, payload, headers={})
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception:
            # Fallback to text from top-level
            return data.get("output_text") or ""


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
        data = _http_post(url, payload, headers={})
        out: List[np.ndarray] = []
        embeddings = data.get("embeddings") or data.get("embeddingsList") or []
        for emb in embeddings:
            vec = emb.get("values") or emb.get("value") or emb.get("embedding", {}).get("values")
            if vec is None:
                vec = []
            out.append(np.array(vec, dtype=np.float32))
        return out

