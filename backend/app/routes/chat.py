from typing import List, Generator

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
import json
from ..config import load_config
from ..models.chat import ChatRequest, ChatResponse, Citation
from ..services.embeddings import EmbeddingService
from ..services.rag import retrieve, build_context_snippets, system_prompt_guidance
from ..storage.vector_store import VectorStore
from ..services.providers.factory import get_chat_provider
from ..dependencies.auth import get_current_user


router = APIRouter(
    prefix="/api/v1",
    tags=["chat"],
    dependencies=[Depends(get_current_user)],
)


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    cfg = load_config()
    # Provider will validate corresponding API key

    top_k = req.top_k or cfg.top_k
    store = VectorStore(cfg.db_path)
    embedder = EmbeddingService.from_config(cfg)

    # Use last user message for retrieval
    if not req.messages:
        raise HTTPException(status_code=422, detail="messages must not be empty")
    last_user = None
    for m in reversed(req.messages):
        if m.role == "user":
            last_user = m.content
            break
    if not last_user:
        raise HTTPException(status_code=422, detail="no user message provided")

    retrieved = retrieve(store, embedder, last_user, top_k=top_k)
    context = build_context_snippets(retrieved)

    # Build prompt
    sys_prompt = system_prompt_guidance()
    user_prompt = f"User question:\n{last_user}\n\nContext sources:\n{context}\n\nAnswer with citations as [n]."

    # Chat via provider
    provider = get_chat_provider(cfg)
    model = (req.chat_model or cfg.chat_model).strip() or cfg.chat_model
    answer = provider.complete(
        messages=[
            {"role": "system", "content": sys_prompt},
            *[{"role": m.role, "content": m.content} for m in req.messages if m.role != "system"],
            {"role": "user", "content": user_prompt},
        ],
        model=model,
        temperature=req.temperature or 0.2,
    )

    citations: List[Citation] = []
    for idx, (cr, score) in enumerate(retrieved, start=1):
        name = cr.metadata.get("name") if isinstance(cr.metadata, dict) else cr.document_id
        snippet = (cr.text or "").strip()
        if len(snippet) > 200:
            snippet = snippet[:200] + "…"
        citations.append(
            Citation(
                document_id=cr.document_id,
                name=name,
                chunk_id=cr.chunk_id,
                score=float(score),
                snippet=snippet,
            )
        )

    return ChatResponse(answer=answer, citations=citations, used_prompt=sys_prompt)


@router.post("/chat/stream")
def chat_stream(req: ChatRequest):
    cfg = load_config()
    # Provider will validate corresponding API key

    top_k = req.top_k or cfg.top_k
    store = VectorStore(cfg.db_path)
    embedder = EmbeddingService.from_config(cfg)

    if not req.messages:
        raise HTTPException(status_code=422, detail="messages must not be empty")
    last_user = None
    for m in reversed(req.messages):
        if m.role == "user":
            last_user = m.content
            break
    if not last_user:
        raise HTTPException(status_code=422, detail="no user message provided")

    retrieved = retrieve(store, embedder, last_user, top_k=top_k)
    context = build_context_snippets(retrieved)

    sys_prompt = system_prompt_guidance()
    user_prompt = f"User question:\n{last_user}\n\nContext sources:\n{context}\n\nAnswer with citations as [n]."

    provider = get_chat_provider(cfg)
    model = (req.chat_model or cfg.chat_model).strip() or cfg.chat_model

    def iter_events() -> Generator[bytes, None, None]:
        try:
            for delta in provider.stream(
                messages=[
                    {"role": "system", "content": sys_prompt},
                    *[{"role": m.role, "content": m.content} for m in req.messages if m.role != "system"],
                    {"role": "user", "content": user_prompt},
                ],
                model=model,
                temperature=req.temperature or 0.2,
            ):
                payload = {"type": "delta", "content": delta}
                yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n".encode("utf-8")
        except Exception as e:
            err = {"type": "error", "message": str(e)}
            yield f"data: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
        # after stream, send citations and prompt
        citations: List[Citation] = []
        for idx, (cr, score) in enumerate(retrieved, start=1):
            name = cr.metadata.get("name") if isinstance(cr.metadata, dict) else cr.document_id
            snippet = (cr.text or "").strip()
            if len(snippet) > 200:
                snippet = snippet[:200] + "…"
            citations.append(
                Citation(
                    document_id=cr.document_id,
                    name=name,
                    chunk_id=cr.chunk_id,
                    score=float(score),
                    snippet=snippet,
                )
            )
        final = {"type": "done", "citations": [c.dict() for c in citations], "used_prompt": sys_prompt}
        yield f"data: {json.dumps(final, ensure_ascii=False)}\n\n".encode("utf-8")

    return StreamingResponse(iter_events(), media_type="text/event-stream")
