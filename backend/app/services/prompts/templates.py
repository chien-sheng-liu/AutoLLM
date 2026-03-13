"""
Prompt templates define which sections are included for each intent type.
Each template is a list of section keys in the order they should appear.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import List


@dataclass
class PromptTemplate:
    name: str
    system_sections: List[str]
    description: str = ""


# Intent analysis — instructs LLM to output structured JSON
INTENT_ANALYSIS_TEMPLATE = PromptTemplate(
    name="intent_analysis",
    description="Used by IntentAnalysisAgent to classify user intent",
    system_sections=[],  # Builder constructs this entirely — not section-based
)

# Standard Q&A with RAG
QA_TEMPLATE = PromptTemplate(
    name="qa",
    description="Standard Q&A with RAG context and citations",
    system_sections=[
        "role_instruction",
        "rag_instruction",
        "citation_format",
        "tone_instruction",
        "length_instruction",
        "language_instruction",
    ],
)

# Summarization
SUMMARIZE_TEMPLATE = PromptTemplate(
    name="summarize",
    description="Summarization task — focus on key points from sources",
    system_sections=[
        "role_instruction",
        "rag_instruction",
        "intent_hint",
        "citation_format",
        "tone_instruction",
        "length_instruction",
        "language_instruction",
    ],
)

# Information extraction
EXTRACT_TEMPLATE = PromptTemplate(
    name="extract",
    description="Extract specific information from sources",
    system_sections=[
        "role_instruction",
        "rag_instruction",
        "intent_hint",
        "citation_format",
        "language_instruction",
    ],
)

# Comparison
COMPARE_TEMPLATE = PromptTemplate(
    name="compare",
    description="Compare information across sources",
    system_sections=[
        "role_instruction",
        "rag_instruction",
        "intent_hint",
        "citation_format",
        "tone_instruction",
        "language_instruction",
    ],
)

# Casual chitchat — no RAG needed
CHITCHAT_TEMPLATE = PromptTemplate(
    name="chitchat",
    description="Casual conversation without RAG retrieval",
    system_sections=[
        "role_instruction",
        "no_rag_instruction",
        "tone_instruction",
        "language_instruction",
    ],
)

# Registry: intent_type -> template
TEMPLATES: dict[str, PromptTemplate] = {
    "qa": QA_TEMPLATE,
    "summarize": SUMMARIZE_TEMPLATE,
    "extract": EXTRACT_TEMPLATE,
    "compare": COMPARE_TEMPLATE,
    "chitchat": CHITCHAT_TEMPLATE,
}
