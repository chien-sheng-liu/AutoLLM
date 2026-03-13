"""
Auto-register all built-in agents when this package is imported.
"""
from .base import BaseAgent, AgentResult, AgentEvent
from .registry import AgentRegistry
from .pipeline import AgentPipeline

# Import agents to trigger @AgentRegistry.register decorators
from . import reasoning   # noqa: F401  — ReasoningAgent (name="reasoning")
from . import answer      # noqa: F401  — AnswerGenerationAgent (name="answer_generation")
from . import chitchat    # noqa: F401  — ChitchatAgent (name="chitchat")

__all__ = [
    "BaseAgent",
    "AgentResult",
    "AgentEvent",
    "AgentRegistry",
    "AgentPipeline",
]
