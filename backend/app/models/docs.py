from pydantic import BaseModel
from typing import Optional, List


class DocumentInfo(BaseModel):
    document_id: str
    name: str
    source: Optional[str] = None


class DocumentList(BaseModel):
    items: List[DocumentInfo]


class UploadResponse(BaseModel):
    document_id: str
    name: str


# Content search models removed per request
