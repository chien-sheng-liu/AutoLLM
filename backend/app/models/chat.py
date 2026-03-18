from pydantic import BaseModel, Field
from typing import List, Optional, Literal


class Citation(BaseModel):
    name: str
    page: Optional[int] = None
    text: Optional[str] = None


class Message(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str
    citations: Optional[List[Citation]] = None


class ChatRequest(BaseModel):
    messages: List[Message] = Field(default_factory=list)
    top_k: Optional[int] = None
    temperature: Optional[float] = 0.2
    chat_model: Optional[str] = None
    chat_provider: Optional[str] = None
    conversation_id: Optional[str] = None
    document_ids: Optional[List[str]] = None


class ChatResponse(BaseModel):
    answer: str
    citations: List[Citation]
    used_prompt: str
    answer_id: str


class FeedbackRequest(BaseModel):
    answer_id: str
    vote: Literal["up", "down"]


class FeedbackResponse(BaseModel):
    ok: bool = True
