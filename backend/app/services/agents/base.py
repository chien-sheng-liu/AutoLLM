"""
BaseAgent, AgentResult, and AgentEvent — the contracts all agents must implement.
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, Generator, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from ...config import Settings


@dataclass
class AgentResult:
    success: bool
    data: Any = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentEvent:
    """Used in streaming mode — emitted by agents via generator."""
    type: str  # "delta" | "done" | "error"
    payload: Any = None


class BaseAgent(ABC):
    """Abstract base for all pipeline agents."""

    name: str = "base"
    description: str = ""

    @abstractmethod
    def execute(self, input_data: Dict[str, Any], cfg: "Settings") -> AgentResult:
        """Synchronous execution. Must be implemented by all agents."""
        ...

    def stream(
        self,
        input_data: Dict[str, Any],
        cfg: "Settings",
    ) -> Generator[AgentEvent, None, None]:
        """
        Streaming execution. Default implementation falls back to execute()
        and emits a single done event — override for true streaming.
        """
        result = self.execute(input_data, cfg)
        if result.success:
            yield AgentEvent(type="done", payload=result.data)
        else:
            yield AgentEvent(type="error", payload=result.error)
