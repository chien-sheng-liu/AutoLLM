"""
AgentRegistry — a simple registry for discovering and instantiating agents.
Register agents at module load time; retrieve them by name at runtime.
"""
from __future__ import annotations
from typing import Dict, List, Type

from .base import BaseAgent


class AgentRegistry:
    _agents: Dict[str, Type[BaseAgent]] = {}

    @classmethod
    def register(cls, agent_class: Type[BaseAgent]) -> Type[BaseAgent]:
        """Register an agent class. Can be used as a decorator."""
        cls._agents[agent_class.name] = agent_class
        return agent_class

    @classmethod
    def get(cls, name: str) -> BaseAgent:
        """Return a fresh instance of the named agent."""
        if name not in cls._agents:
            raise KeyError(f"Agent '{name}' is not registered. Available: {cls.list_agents()}")
        return cls._agents[name]()

    @classmethod
    def list_agents(cls) -> List[str]:
        return list(cls._agents.keys())
