from __future__ import annotations
from typing import Optional

from ...config import Settings
from .base import ChatProvider, EmbeddingProvider, ProviderError
from .openai_provider import OpenAIChatProvider, OpenAIEmbeddingProvider
from .gemini_provider import GeminiChatProvider, GeminiEmbeddingProvider
from .anthropic_provider import AnthropicChatProvider


def get_chat_provider(cfg: Settings) -> ChatProvider:
    p = (cfg.chat_provider or "openai").lower()
    if p == "openai":
        if not cfg.openai_api_key:
            raise ProviderError("openai", "missing_key", "OPENAI_API_KEY not configured")
        return OpenAIChatProvider(cfg.openai_api_key)
    if p in ("gemini", "google"):
        if not cfg.google_api_key:
            raise ProviderError("gemini", "missing_key", "GOOGLE_API_KEY (for Gemini) not configured")
        return GeminiChatProvider(cfg.google_api_key)
    if p in ("anthropic", "claude"):
        if not cfg.anthropic_api_key:
            raise ProviderError("anthropic", "missing_key", "ANTHROPIC_API_KEY not configured")
        return AnthropicChatProvider(cfg.anthropic_api_key)
    raise ProviderError(p, "unknown_provider", f"Unknown chat provider: {p}")


def get_embedding_provider(cfg: Settings) -> EmbeddingProvider:
    p = (cfg.embedding_provider or "openai").lower()
    if p == "openai":
        if not cfg.openai_api_key:
            raise ProviderError("openai", "missing_key", "OPENAI_API_KEY not configured")
        return OpenAIEmbeddingProvider(cfg.openai_api_key)
    if p in ("gemini", "google"):
        if not cfg.google_api_key:
            raise ProviderError("gemini", "missing_key", "GOOGLE_API_KEY (for Gemini) not configured")
        return GeminiEmbeddingProvider(cfg.google_api_key)
    # Anthropic does not provide embeddings; fall back to OpenAI when available
    if p in ("anthropic", "claude"):
        if cfg.openai_api_key:
            return OpenAIEmbeddingProvider(cfg.openai_api_key)
        raise ProviderError("anthropic", "embedding_not_supported", "Embeddings not supported for Anthropic and no OpenAI key available")
    raise ProviderError(p, "unknown_provider", f"Unknown embedding provider: {p}")
