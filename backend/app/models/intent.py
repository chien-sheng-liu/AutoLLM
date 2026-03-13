from __future__ import annotations
from typing import List
from pydantic import BaseModel, Field


class IntentResult(BaseModel):
    """Structured output from the Reasoning Agent."""

    intent_type: str = Field(
        default="qa",
        description="Classified intent: 'qa' | 'chitchat' | 'summarize' | 'extract' | 'compare'",
    )
    keywords: List[str] = Field(
        default_factory=list,
        description="Key terms extracted from the user message for RAG retrieval optimization",
    )
    needs_rag: bool = Field(
        default=True,
        description="Whether RAG retrieval is needed (False for chitchat/greetings)",
    )
    language: str = Field(
        default="zh",
        description="Detected language code: 'zh', 'en', etc.",
    )
    complexity: str = Field(
        default="moderate",
        description="Estimated complexity: 'simple' | 'moderate' | 'complex'",
    )
    # Safety filter
    blocked: bool = Field(
        default=False,
        description="Whether this message should be blocked (prompt injection, harmful content, etc.)",
    )
    blocked_reason: str = Field(
        default="",
        description="User-facing reason when blocked=True",
    )
    # Routing decision
    route: str = Field(
        default="answer_generation",
        description="Target sub-agent name for downstream routing",
    )
    raw_analysis: str = Field(
        default="",
        description="Raw LLM analysis text for debugging purposes",
    )

    @classmethod
    def default(cls) -> "IntentResult":
        """Safe default used as fallback when LLM parsing fails."""
        return cls(
            intent_type="qa",
            keywords=[],
            needs_rag=True,
            language="zh",
            complexity="moderate",
            blocked=False,
            blocked_reason="",
            route="answer_generation",
            raw_analysis="",
        )
