from pydantic import BaseModel, Field
from typing import List, Optional, Literal


class Message(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: List[Message] = Field(default_factory=list)
    top_k: Optional[int] = None
    temperature: Optional[float] = 0.2
    chat_model: Optional[str] = None


class Citation(BaseModel):
    document_id: str
    name: str
    chunk_id: str
    score: float
    snippet: str


class ChatResponse(BaseModel):
    answer: str
    citations: List[Citation]
    used_prompt: str
