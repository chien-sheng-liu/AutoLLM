"""
Auto-register all built-in agents when this package is imported.
"""
from .base import BaseAgent, AgentResult, AgentEvent
from .registry import AgentRegistry
from .pipeline import AgentPipeline

# Import agents to trigger @AgentRegistry.register decorators
from . import intent  # noqa: F401
from . import answer  # noqa: F401

__all__ = [
    "BaseAgent",
    "AgentResult",
    "AgentEvent",
    "AgentRegistry",
    "AgentPipeline",
]
