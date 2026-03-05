from __future__ import annotations
from typing import Iterable, List, Generator
import numpy as np
from openai import OpenAI

from .base import ChatProvider, EmbeddingProvider


class OpenAIChatProvider(ChatProvider):
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)

    def complete(self, messages: List[dict], model: str, temperature: float = 0.2) -> str:
        resp = self.client.chat.completions.create(
            model=model,
            temperature=temperature,
            messages=messages,
        )
        return resp.choices[0].message.content or ""

    def stream(self, messages: List[dict], model: str, temperature: float = 0.2) -> Generator[str, None, None]:
        stream = self.client.chat.completions.create(
            model=model,
            temperature=temperature,
            stream=True,
            messages=messages,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices and chunk.choices[0].delta else None
            if delta:
                yield delta


class OpenAIEmbeddingProvider(EmbeddingProvider):
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)

    def embed_texts(self, texts: Iterable[str], model: str) -> List[np.ndarray]:
        batch = list(texts)
        if not batch:
            return []
        resp = self.client.embeddings.create(model=model, input=batch)
        return [np.array(item.embedding, dtype=np.float32) for item in resp.data]

