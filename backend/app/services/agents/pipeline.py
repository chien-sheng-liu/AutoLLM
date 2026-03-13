"""
AgentPipeline — orchestrates the reasoning + routing + sub-agent flow.

Flow:
  1. ReasoningAgent runs synchronously
     a. If blocked=True  → short-circuit, return blocked message
     b. Read intent.route → resolve the target sub-agent name
  2. Optional RAG retrieval hook (injected by caller via pre_answer_hook)
  3. Target sub-agent runs (sync or stream)

Extending:
  - Add a new sub-agent: implement BaseAgent, register it, add its name to
    ReasoningAgent.DEFAULT_ROUTE_MAP. No changes needed here.
  - Conditional branching: override run() in a subclass or pass a custom
    route_map to __init__ when more complex routing logic is needed.
"""
from __future__ import annotations
import logging
from typing import Any, Callable, Dict, Generator, List, Optional, TYPE_CHECKING

from .registry import AgentRegistry
from .base import AgentEvent
from ...models.intent import IntentResult

if TYPE_CHECKING:
    from ...config import Settings

logger = logging.getLogger(__name__)

REASONING_AGENT = "reasoning"

# Signature for the optional hook called after reasoning and before the sub-agent.
# Receives the current context dict, mutates it in-place (e.g., adds "context" key).
PreAnswerHook = Callable[[Dict[str, Any]], None]


class AgentPipeline:
    def __init__(self, pre_answer_hook: Optional[PreAnswerHook] = None):
        """
        pre_answer_hook: called between reasoning and the sub-agent.
        Use it to inject RAG context into the shared dict when needs_rag=True.
        """
        self._hook = pre_answer_hook

    # ------------------------------------------------------------------
    # Synchronous execution
    # ------------------------------------------------------------------

    def run(self, initial_input: Dict[str, Any], cfg: "Settings") -> Dict[str, Any]:
        """Run reasoning → (optional hook) → sub-agent. Returns accumulated context dict."""
        context = dict(initial_input)

        # Step 1: Reasoning
        intent = self._run_reasoning(context, cfg)
        context["intent"] = intent

        # Step 2: Safety gate
        if intent.blocked:
            reason = intent.blocked_reason or "很抱歉，我無法回應這個請求。"
            context["answer"] = reason
            context["blocked"] = True
            return context

        # Step 3: Pre-answer hook (e.g., RAG retrieval)
        if self._hook and intent.needs_rag:
            self._hook(context)

        # Step 4: Route to sub-agent
        sub_agent_name = intent.route or "answer_generation"
        result = AgentRegistry.get(sub_agent_name).execute(context, cfg)
        if not result.success:
            raise RuntimeError(f"Sub-agent '{sub_agent_name}' failed: {result.error}")
        context["answer"] = result.data
        return context

    # ------------------------------------------------------------------
    # Streaming execution
    # ------------------------------------------------------------------

    def run_stream(
        self,
        initial_input: Dict[str, Any],
        cfg: "Settings",
    ) -> Generator[AgentEvent, None, None]:
        """
        Run reasoning synchronously, then stream the sub-agent.
        Yields AgentEvent(type="delta"|"done"|"error").
        """
        context = dict(initial_input)

        # Step 1: Reasoning (always sync — lightweight + fast)
        intent = self._run_reasoning(context, cfg)
        context["intent"] = intent

        # Step 2: Safety gate
        if intent.blocked:
            reason = intent.blocked_reason or "很抱歉，我無法回應這個請求。"
            yield AgentEvent(type="delta", payload=reason)
            yield AgentEvent(type="done", payload={"blocked": True})
            return

        # Step 3: Pre-answer hook (e.g., RAG retrieval)
        if self._hook and intent.needs_rag:
            self._hook(context)

        # Step 4: Stream from sub-agent
        sub_agent_name = intent.route or "answer_generation"
        yield from AgentRegistry.get(sub_agent_name).stream(context, cfg)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _run_reasoning(self, context: Dict[str, Any], cfg: "Settings") -> IntentResult:
        result = AgentRegistry.get(REASONING_AGENT).execute(context, cfg)
        if result.success and isinstance(result.data, IntentResult):
            return result.data
        logger.warning("ReasoningAgent returned unexpected result; using safe default")
        return IntentResult.default()
