"""
IntentAnalysisAgent — Layer 1 of the pipeline.
Classifies user intent and extracts keywords for RAG optimization.
Uses a lightweight model for speed and cost efficiency.
"""
from __future__ import annotations
import json
import logging
from typing import Any, Dict, List, TYPE_CHECKING

from .base import BaseAgent, AgentResult
from .registry import AgentRegistry
from ..prompts.builder import PromptBuilder
from ..providers.factory import get_chat_provider
from ...models.intent import IntentResult

if TYPE_CHECKING:
    from ...config import Settings

logger = logging.getLogger(__name__)


@AgentRegistry.register
class IntentAnalysisAgent(BaseAgent):
    name = "intent_analysis"
    description = "Classifies user intent and extracts keywords for downstream agents."

    def execute(self, input_data: Dict[str, Any], cfg: "Settings") -> AgentResult:
        """
        Input:
            question (str): The latest user message.
            conversation_history (List[dict], optional): Recent messages for context.

        Output:
            AgentResult.data = IntentResult
        """
        question: str = input_data.get("question", "")
        history: List[dict] = input_data.get("conversation_history", [])

        if not cfg.enable_intent_analysis:
            return AgentResult(success=True, data=IntentResult.default())

        builder = PromptBuilder(cfg)
        messages = builder.build_intent_messages(question, history)

        # Use intent-specific model/provider if configured, otherwise fall back to chat provider
        from dataclasses import replace
        intent_provider = cfg.intent_provider or cfg.chat_provider
        intent_model = cfg.intent_model or cfg.chat_model
        intent_cfg = replace(cfg, chat_provider=intent_provider)

        try:
            provider = get_chat_provider(intent_cfg)
            raw = provider.complete(
                messages=messages,
                model=intent_model,
                temperature=0.0,  # deterministic for classification
                max_tokens=300,
            )
        except Exception as exc:
            logger.warning("IntentAnalysisAgent: LLM call failed (%s), using default intent", exc)
            return AgentResult(success=True, data=IntentResult.default(), metadata={"fallback": True})

        intent = self._parse_intent(raw)
        return AgentResult(success=True, data=intent, metadata={"raw": raw})

    # ------------------------------------------------------------------
    # Parsing helpers
    # ------------------------------------------------------------------

    def _parse_intent(self, raw: str) -> IntentResult:
        """Parse JSON from LLM output with robust fallback."""
        try:
            # Strip markdown code fences if present
            text = raw.strip()
            if text.startswith("```"):
                lines = text.splitlines()
                text = "\n".join(
                    line for line in lines if not line.startswith("```")
                ).strip()

            data = json.loads(text)
            return IntentResult(
                intent_type=str(data.get("intent_type", "qa")).lower(),
                keywords=[str(k) for k in data.get("keywords", [])],
                needs_rag=bool(data.get("needs_rag", True)),
                language=str(data.get("language", "zh")),
                complexity=str(data.get("complexity", "moderate")).lower(),
                raw_analysis=raw,
            )
        except Exception as exc:
            logger.warning("IntentAnalysisAgent: failed to parse JSON (%s), using default", exc)
            fallback = IntentResult.default()
            fallback.raw_analysis = raw
            return fallback
