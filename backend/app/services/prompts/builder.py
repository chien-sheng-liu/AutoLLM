"""
PromptBuilder — assembles final prompts from sections + templates.
All LLM message construction should go through this class.
"""
from __future__ import annotations
from typing import List, TYPE_CHECKING

from . import sections as sec
from .templates import TEMPLATES, QA_TEMPLATE

if TYPE_CHECKING:
    from ...models.intent import IntentResult
    from ...config import Settings


class PromptBuilder:
    """Builds system and user prompts based on intent and configuration."""

    def __init__(self, cfg: "Settings"):
        self._cfg = cfg

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def build_intent_messages(self, question: str, conversation_history: List[dict] | None = None) -> List[dict]:
        """Build messages for the Intent Analysis Agent."""
        system = (
            "You are an intent classifier. Analyze the user's message and respond with a JSON object.\n"
            "Output ONLY valid JSON with these fields:\n"
            '  "intent_type": one of "qa" | "chitchat" | "summarize" | "extract" | "compare"\n'
            '  "keywords": list of key terms useful for document retrieval (empty list for chitchat)\n'
            '  "needs_rag": true if document retrieval is needed, false for chitchat/greetings\n'
            '  "language": detected language code ("zh" or "en" or other ISO 639-1 code)\n'
            '  "complexity": one of "simple" | "moderate" | "complex"\n'
            "\nDo not include any explanation outside the JSON object."
        )
        messages: List[dict] = [{"role": "system", "content": system}]
        # Optionally include a small slice of recent history for context
        if conversation_history:
            for msg in conversation_history[-4:]:
                role = str(msg.get("role", "")).lower()
                content = str(msg.get("content", ""))
                if role in ("user", "assistant") and content:
                    messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": question})
        return messages

    def build_system_prompt(self, intent: "IntentResult") -> str:
        """Build the system prompt for the Answer Generation Agent based on intent."""
        cfg = self._cfg
        template = TEMPLATES.get(intent.intent_type, QA_TEMPLATE)
        parts: List[str] = []

        for section_key in template.system_sections:
            text = self._resolve_section(section_key, intent)
            if text:
                parts.append(text)

        return "\n".join(parts)

    def build_user_prompt(self, question: str, context: str, intent: "IntentResult") -> str:
        """Build the user-turn message combining the question and RAG context."""
        if intent.needs_rag and context.strip():
            return (
                f"User question:\n{question}\n\n"
                f"{sec.context_injection(context)}\n\n"
                "Answer with citations as [n]."
            )
        return f"User question:\n{question}"

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _resolve_section(self, key: str, intent: "IntentResult") -> str:
        cfg = self._cfg
        overrides: dict = getattr(cfg, "prompt_overrides", {}) or {}

        # Map template section keys to prompt_overrides keys
        override_key_map = {
            "role_instruction": "answer_role",
            "rag_instruction": "answer_rag",
            "citation_format": "answer_citation",
        }
        override_lookup = override_key_map.get(key, key)
        if override_lookup in overrides and overrides[override_lookup]:
            return overrides[override_lookup]

        if key == "role_instruction":
            return sec.role_instruction()
        if key == "rag_instruction":
            return sec.rag_instruction()
        if key == "no_rag_instruction":
            return sec.no_rag_instruction()
        if key == "citation_format":
            return sec.citation_format()
        if key == "tone_instruction":
            return sec.tone_instruction(getattr(cfg, "creativity", "balanced"))
        if key == "length_instruction":
            return sec.length_instruction(getattr(cfg, "answer_length", "medium"))
        if key == "language_instruction":
            return sec.language_instruction(intent.language)
        if key == "intent_hint":
            return sec.intent_hint(intent)
        return ""
