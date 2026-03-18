"""
AnswerGenerationAgent — Layer 2 of the pipeline.
Generates the final answer using RAG context and the intent from Layer 1.
"""
from __future__ import annotations
import logging
from dataclasses import replace
from typing import Any, Dict, Generator, List, TYPE_CHECKING

from .base import BaseAgent, AgentResult, AgentEvent
from .registry import AgentRegistry
from ..prompts.builder import PromptBuilder
from ..providers.base import ProviderError
from ..providers.factory import get_chat_provider
from ...models.intent import IntentResult

if TYPE_CHECKING:
    from ...config import Settings

logger = logging.getLogger(__name__)


@AgentRegistry.register
class AnswerGenerationAgent(BaseAgent):
    name = "answer_generation"
    description = "Generates the final answer using RAG context and detected intent."

    def execute(self, input_data: Dict[str, Any], cfg: "Settings") -> AgentResult:
        """
        Input:
            question (str): The latest user message.
            context (str): RAG context string (may be empty if needs_rag=False).
            intent (IntentResult): Output from IntentAnalysisAgent.
            messages (List[dict]): Full conversation history for multi-turn context.

        Output:
            AgentResult.data = str (the answer text)
        """
        question: str = input_data.get("question", "")
        context: str = input_data.get("context", "")
        intent: IntentResult = input_data.get("intent", IntentResult.default())
        messages: List[dict] = input_data.get("messages", [])
        model: str = input_data.get("model", cfg.chat_model)
        temperature: float = input_data.get("temperature", cfg.temperature)

        messages_payload = self._build_messages(question, context, intent, messages, cfg)
        answer = self._call_provider(messages_payload, model, temperature, cfg)
        return AgentResult(success=True, data=answer)

    def stream(
        self,
        input_data: Dict[str, Any],
        cfg: "Settings",
    ) -> Generator[AgentEvent, None, None]:
        """Stream answer deltas as AgentEvents."""
        question: str = input_data.get("question", "")
        context: str = input_data.get("context", "")
        intent: IntentResult = input_data.get("intent", IntentResult.default())
        messages: List[dict] = input_data.get("messages", [])
        model: str = input_data.get("model", cfg.chat_model)
        temperature: float = input_data.get("temperature", cfg.temperature)

        messages_payload = self._build_messages(question, context, intent, messages, cfg)
        provider_cfg = replace(cfg, chat_provider=cfg.chat_provider)
        provider = get_chat_provider(provider_cfg)

        try:
            for delta in provider.stream(
                messages=messages_payload,
                model=model,
                temperature=temperature,
                max_tokens=cfg.max_tokens,
                top_p=cfg.top_p,
                presence_penalty=cfg.presence_penalty,
                frequency_penalty=cfg.frequency_penalty,
            ):
                yield AgentEvent(type="delta", payload=delta)
        except ProviderError as exc:
            # Try fallback provider as a non-streaming complete
            fb_answer = self._try_fallback(messages_payload, temperature, cfg)
            if fb_answer is not None:
                yield AgentEvent(type="delta", payload=fb_answer)
            else:
                yield AgentEvent(type="error", payload=exc.to_dict())
                return
        except Exception as exc:
            fb_answer = self._try_fallback(messages_payload, temperature, cfg)
            if fb_answer is not None:
                yield AgentEvent(type="delta", payload=fb_answer)
            else:
                yield AgentEvent(type="error", payload={"message": str(exc)})
                return

        yield AgentEvent(type="done", payload=None)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_messages(
        self,
        question: str,
        context: str,
        intent: IntentResult,
        messages: List[dict],
        cfg: "Settings",
    ) -> List[dict]:
        builder = PromptBuilder(cfg)
        system_prompt = builder.build_system_prompt(intent)
        user_prompt = builder.build_user_prompt(question, context, intent)
        return [
            {"role": "system", "content": system_prompt},
            *[{"role": m["role"], "content": m["content"]} for m in messages if m.get("role") != "system"],
            {"role": "user", "content": user_prompt},
        ]

    def _call_provider(
        self,
        messages_payload: List[dict],
        model: str,
        temperature: float,
        cfg: "Settings",
    ) -> str:
        provider = get_chat_provider(cfg)
        try:
            return provider.complete(
                messages=messages_payload,
                model=model,
                temperature=temperature,
                max_tokens=cfg.max_tokens,
                top_p=cfg.top_p,
                presence_penalty=cfg.presence_penalty,
                frequency_penalty=cfg.frequency_penalty,
            )
        except ProviderError:
            fb = self._try_fallback(messages_payload, temperature, cfg)
            if fb is not None:
                return fb
            raise
        except Exception:
            fb = self._try_fallback(messages_payload, temperature, cfg)
            if fb is not None:
                return fb
            raise

    def _try_fallback(
        self,
        messages_payload: List[dict],
        temperature: float,
        cfg: "Settings",
    ) -> str | None:
        if not (cfg.fallback_chat_provider and cfg.fallback_chat_model):
            return None
        try:
            fb_cfg = replace(cfg, chat_provider=cfg.fallback_chat_provider)
            fb = get_chat_provider(fb_cfg)
            return fb.complete(messages=messages_payload, model=cfg.fallback_chat_model, temperature=temperature)
        except Exception as exc:
            logger.warning("AnswerGenerationAgent: fallback provider also failed (%s)", exc)
            return None
