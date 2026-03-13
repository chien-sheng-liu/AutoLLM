"""
AgentPipeline — orchestrates a sequence of agents.

Design notes:
- Linear pipeline only (current). The data dict flows through each agent
  sequentially; each agent's output is merged into the shared context.
- Branching/conditional routing is reserved for future extension:
  override run() in a subclass or add a routing hook when needed.
- For streaming: all agents except the last run synchronously;
  the final agent streams its output.
"""
from __future__ import annotations
import logging
from typing import Any, Dict, Generator, List, Optional, TYPE_CHECKING

from .registry import AgentRegistry
from .base import AgentEvent

if TYPE_CHECKING:
    from ...config import Settings

logger = logging.getLogger(__name__)

# Default pipeline agent sequence
DEFAULT_PIPELINE = ["intent_analysis", "answer_generation"]


class AgentPipeline:
    def __init__(self, agents: Optional[List[str]] = None):
        self._agent_names: List[str] = agents if agents is not None else DEFAULT_PIPELINE

    # ------------------------------------------------------------------
    # Synchronous execution
    # ------------------------------------------------------------------

    def run(self, initial_input: Dict[str, Any], cfg: "Settings") -> Dict[str, Any]:
        """
        Run all agents sequentially.
        Returns the accumulated context dict after all agents complete.
        Raises on unrecoverable errors.
        """
        context = dict(initial_input)
        for name in self._agent_names:
            agent = AgentRegistry.get(name)
            result = agent.execute(context, cfg)
            if not result.success:
                raise RuntimeError(f"Agent '{name}' failed: {result.error}")
            # Merge agent output into context so downstream agents can access it
            context = self._merge(context, name, result.data)
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
        Run all agents except the last synchronously, then stream the last one.
        Yields AgentEvent(type="delta"|"done"|"error") from the final agent.
        """
        context = dict(initial_input)
        sync_agents = self._agent_names[:-1]
        stream_agent_name = self._agent_names[-1]

        # Run all but the last synchronously
        for name in sync_agents:
            agent = AgentRegistry.get(name)
            result = agent.execute(context, cfg)
            if not result.success:
                yield AgentEvent(type="error", payload={"message": f"Agent '{name}' failed: {result.error}"})
                return
            context = self._merge(context, name, result.data)

        # Stream the final agent
        final_agent = AgentRegistry.get(stream_agent_name)
        yield from final_agent.stream(context, cfg)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _merge(self, context: Dict[str, Any], agent_name: str, data: Any) -> Dict[str, Any]:
        """Merge agent output into context. Convention: intent_analysis -> context["intent"]."""
        updated = dict(context)
        if agent_name == "intent_analysis":
            updated["intent"] = data
        elif agent_name == "answer_generation":
            updated["answer"] = data
        else:
            # Generic fallback: store under agent name
            updated[agent_name] = data
        return updated
