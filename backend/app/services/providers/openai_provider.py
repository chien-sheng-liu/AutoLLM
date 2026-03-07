from __future__ import annotations
from typing import Iterable, List, Generator
import numpy as np
from openai import OpenAI

from .base import ChatProvider, EmbeddingProvider


class OpenAIChatProvider(ChatProvider):
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)

    def complete(
        self,
        messages: List[dict],
        model: str,
        temperature: float = 0.2,
        *,
        max_tokens: int | None = None,
        top_p: float | None = None,
        presence_penalty: float | None = None,
        frequency_penalty: float | None = None,
    ) -> str:
        kwargs = {"model": model, "temperature": temperature, "messages": messages}
        if max_tokens is not None:
            kwargs["max_tokens"] = int(max_tokens)
        if top_p is not None:
            kwargs["top_p"] = float(top_p)
        if presence_penalty is not None:
            kwargs["presence_penalty"] = float(presence_penalty)
        if frequency_penalty is not None:
            kwargs["frequency_penalty"] = float(frequency_penalty)
        resp = self.client.chat.completions.create(**kwargs)
        return resp.choices[0].message.content or ""

    def stream(
        self,
        messages: List[dict],
        model: str,
        temperature: float = 0.2,
        *,
        max_tokens: int | None = None,
        top_p: float | None = None,
        presence_penalty: float | None = None,
        frequency_penalty: float | None = None,
    ) -> Generator[str, None, None]:
        kwargs = {"model": model, "temperature": temperature, "messages": messages, "stream": True}
        if max_tokens is not None:
            kwargs["max_tokens"] = int(max_tokens)
        if top_p is not None:
            kwargs["top_p"] = float(top_p)
        if presence_penalty is not None:
            kwargs["presence_penalty"] = float(presence_penalty)
        if frequency_penalty is not None:
            kwargs["frequency_penalty"] = float(frequency_penalty)
        stream = self.client.chat.completions.create(**kwargs)
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
