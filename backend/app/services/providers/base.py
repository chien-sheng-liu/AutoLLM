from __future__ import annotations
from typing import Iterable, List, Generator
import numpy as np


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
