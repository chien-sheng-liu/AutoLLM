"""
Modular prompt sections — each function returns a self-contained prompt fragment.
Compose these via PromptBuilder rather than concatenating raw strings.
"""
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ...models.intent import IntentResult


def role_instruction() -> str:
    return "You are a helpful assistant that answers questions based on provided sources."


def rag_instruction() -> str:
    return (
        "Only answer using the provided context sources. "
        "If the answer cannot be found in the sources, say you don't know."
    )


def citation_format() -> str:
    return "Cite sources inline as [n] where n is the 1-based index of the source."


def no_rag_instruction() -> str:
    return "Answer the user's message naturally. No source documents are available for this query."


def tone_instruction(style: str) -> str:
    mapping = {
        "precise": "Be concise, factual, and avoid speculation.",
        "balanced": "Be clear and helpful, balancing detail with brevity.",
        "creative": "Be expressive and explore different angles in your answer.",
    }
    return mapping.get(style, mapping["balanced"])


def length_instruction(length: str) -> str:
    mapping = {
        "short": "Keep your answer brief — one to three sentences.",
        "medium": "Provide a moderate-length answer covering the key points.",
        "long": "Provide a thorough, detailed answer.",
    }
    return mapping.get(length, mapping["medium"])


def language_instruction(lang: str) -> str:
    if lang == "zh":
        return "回答請使用繁體中文。"
    if lang == "en":
        return "Answer in English."
    return f"Answer in the same language as the user's question (detected: {lang})."


def context_injection(context: str) -> str:
    if not context.strip():
        return ""
    return f"Context sources:\n{context}"


def intent_hint(intent: "IntentResult") -> str:
    """Optionally hint the answer agent about detected intent."""
    hints = {
        "summarize": "The user is asking for a summary. Focus on key points.",
        "extract": "The user wants specific information extracted. Be precise.",
        "compare": "The user wants a comparison. Structure your answer clearly.",
        "chitchat": "This is a casual conversation. Be friendly.",
        "qa": "",
    }
    return hints.get(intent.intent_type, "")
