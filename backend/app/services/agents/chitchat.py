"""
ChitchatAgent — handles casual conversation without RAG retrieval.

Characteristics:
  - No document retrieval needed (needs_rag=False)
  - Friendly, natural conversational tone
  - Does not cite sources
  - Suitable for: greetings, off-topic questions, clarifications about the system
"""
from __future__ import annotations
import logging
from dataclasses import replace
from typing import Any, Dict, Generator, List, TYPE_CHECKING

from .base import BaseAgent, AgentResult, AgentEvent
from .registry import AgentRegistry
from ..providers.base import ProviderError
from ..providers.factory import get_chat_provider
from ...models.intent import IntentResult

if TYPE_CHECKING:
    from ...config import Settings

logger = logging.getLogger(__name__)


@AgentRegistry.register
class ChitchatAgent(BaseAgent):
    name = "chitchat"
    description = (
        "Handles casual conversation and off-topic questions "
        "without document retrieval. Responds in a friendly, natural tone."
    )

    def execute(self, input_data: Dict[str, Any], cfg: "Settings") -> AgentResult:
        """
        Input:
            question (str): The latest user message.
            intent (IntentResult): Output from ReasoningAgent.
            messages (List[dict]): Conversation history for multi-turn context.

        Output:
            AgentResult.data = str (the answer text)
        """
        messages_payload = self._build_messages(input_data, cfg)
        model: str = input_data.get("model", cfg.chat_model)
        temperature: float = input_data.get("temperature", cfg.temperature)

        provider = get_chat_provider(cfg)
        try:
            answer = provider.complete(
                messages=messages_payload,
                model=model,
                temperature=max(temperature, 0.5),  # chitchat benefits from slightly more warmth
                max_tokens=cfg.max_tokens,
            )
            return AgentResult(success=True, data=answer)
        except ProviderError as exc:
            fb = self._try_fallback(messages_payload, temperature, cfg)
            if fb is not None:
                return AgentResult(success=True, data=fb)
            return AgentResult(success=False, error=str(exc))
        except Exception as exc:
            return AgentResult(success=False, error=str(exc))

    def stream(
        self,
        input_data: Dict[str, Any],
        cfg: "Settings",
    ) -> Generator[AgentEvent, None, None]:
        messages_payload = self._build_messages(input_data, cfg)
        model: str = input_data.get("model", cfg.chat_model)
        temperature: float = input_data.get("temperature", cfg.temperature)

        provider = get_chat_provider(cfg)
        try:
            for delta in provider.stream(
                messages=messages_payload,
                model=model,
                temperature=max(temperature, 0.5),
                max_tokens=cfg.max_tokens,
            ):
                yield AgentEvent(type="delta", payload=delta)
        except Exception as exc:
            fb = self._try_fallback(messages_payload, temperature, cfg)
            if fb is not None:
                yield AgentEvent(type="delta", payload=fb)
            else:
                yield AgentEvent(type="error", payload={"message": str(exc)})
                return

        yield AgentEvent(type="done", payload=None)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_messages(self, input_data: Dict[str, Any], cfg: "Settings") -> List[dict]:
        question: str = input_data.get("question", "")
        intent: IntentResult = input_data.get("intent", IntentResult.default())
        messages: List[dict] = input_data.get("messages", [])

        override = (cfg.prompt_overrides or {}).get("chitchat_system", "")
        system = override if override else self._default_system_prompt(intent.language)

        return [
            {"role": "system", "content": system},
            *[{"role": m["role"], "content": m["content"]} for m in messages if m.get("role") != "system"],
            {"role": "user", "content": question},
        ]

    @staticmethod
    def _default_system_prompt(language: str = "zh") -> str:
        lang_hint = "請用繁體中文回答。" if language == "zh" else f"Answer in {language}."
        return (
            "You are a friendly and helpful assistant. "
            "The user is having a casual conversation or asking a general question. "
            "Respond naturally and warmly. "
            "You do not have access to any documents for this conversation. "
            f"{lang_hint}"
        )

    def _try_fallback(self, messages_payload: List[dict], temperature: float, cfg: "Settings") -> str | None:
        if not (cfg.fallback_chat_provider and cfg.fallback_chat_model):
            return None
        try:
            fb_cfg = replace(cfg, chat_provider=cfg.fallback_chat_provider)
            fb = get_chat_provider(fb_cfg)
            return fb.complete(messages=messages_payload, model=cfg.fallback_chat_model, temperature=temperature)
        except Exception as exc:
            logger.warning("ChitchatAgent: fallback provider also failed (%s)", exc)
            return None
