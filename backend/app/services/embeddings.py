from typing import Iterable, List
import numpy as np

from ..config import Settings
from .providers.factory import get_embedding_provider


class EmbeddingService:
    def __init__(self, provider, model: str):
        self._provider = provider
        self.model = model

    @classmethod
    def from_config(cls, cfg: Settings):
        try:
            provider = get_embedding_provider(cfg)
        except Exception as e:
            from fastapi import HTTPException
            raise HTTPException(status_code=422, detail=str(e))
        return cls(provider, cfg.embedding_model)

    def embed_texts(self, texts: Iterable[str]) -> List[np.ndarray]:
        return self._provider.embed_texts(texts, self.model)
