from typing import List, Generator

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
import json
from ..config import load_config
from ..models.chat import ChatRequest, ChatResponse, Citation
from ..services.embeddings import EmbeddingService
from ..services.rag import retrieve, build_context_snippets, system_prompt_guidance
from ..storage.vector_store import VectorStore
from ..storage.chat_store import get_chat_store
from ..services.providers.factory import get_chat_provider
from ..dependencies.auth import get_current_user
from ..models.auth import UserOut
from dataclasses import replace
from ..storage.user_store import get_user_store


router = APIRouter(
    prefix="/api/v1",
    tags=["chat"],
    dependencies=[Depends(get_current_user)],
)


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, current_user: UserOut = Depends(get_current_user)):
    cfg = load_config()
    # Provider will validate corresponding API key

    top_k = req.top_k or cfg.top_k
    store = VectorStore(cfg)
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

    # Document permissions: if user has explicit permissions, restrict retrieval; otherwise allow all
    user_store = get_user_store(cfg)
    allow_ids = user_store.get_user_allowed_docs(current_user.id)
    if not allow_ids:
        allow_ids = None  # None => no restriction
    retrieved = retrieve(store, embedder, last_user, top_k=top_k, allow_document_ids=allow_ids)
    context = build_context_snippets(retrieved)

    # Build prompt
    sys_prompt = system_prompt_guidance()
    user_prompt = f"User question:\n{last_user}\n\nContext sources:\n{context}\n\nAnswer with citations as [n]."

    # Chat via provider
    # Allow provider override per request
    provider_cfg = replace(cfg, chat_provider=(req.chat_provider or cfg.chat_provider).lower())
    provider = get_chat_provider(provider_cfg)
    model = (req.chat_model or cfg.chat_model).strip() or cfg.chat_model
    temperature = req.temperature if req.temperature is not None else cfg.temperature
    messages_payload = [
        {"role": "system", "content": sys_prompt},
        *[{"role": m.role, "content": m.content} for m in req.messages if m.role != "system"],
        {"role": "user", "content": user_prompt},
    ]
    try:
        answer = provider.complete(
            messages=messages_payload,
            model=model,
            temperature=temperature,
            max_tokens=cfg.max_tokens,
            top_p=cfg.top_p,
            presence_penalty=cfg.presence_penalty,
            frequency_penalty=cfg.frequency_penalty,
        )
    except Exception:
        # Fallback if configured
        fb_provider = cfg.fallback_chat_provider
        fb_model = cfg.fallback_chat_model
        if fb_provider and fb_model:
            fb_cfg = replace(cfg, chat_provider=fb_provider)
            fb = get_chat_provider(fb_cfg)
            answer = fb.complete(messages=messages_payload, model=fb_model, temperature=temperature)
        else:
            raise

    citations: List[Citation] = []
    for idx, (cr, _score) in enumerate(retrieved, start=1):
        name = cr.metadata.get("name") if isinstance(cr.metadata, dict) else cr.document_id
        page = None
        if isinstance(cr.metadata, dict):
            p = cr.metadata.get("page")
            if isinstance(p, int):
                page = p
        citations.append(Citation(name=name, page=page))

    # Log chat message and return answer_id
    store = get_chat_store(cfg)
    answer_id = store.insert_chat_message(
        user_id=current_user.id,
        question=last_user,
        answer=answer,
        citations=[c.dict() for c in citations],
        used_prompt=sys_prompt,
    )

    return ChatResponse(answer=answer, citations=citations, used_prompt=sys_prompt, answer_id=answer_id)


@router.post("/chat/stream")
def chat_stream(req: ChatRequest, current_user: UserOut = Depends(get_current_user)):
    cfg = load_config()
    # Provider will validate corresponding API key

    top_k = req.top_k or cfg.top_k
    store = VectorStore(cfg)
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

    user_store = get_user_store(cfg)
    allow_ids = user_store.get_user_allowed_docs(current_user.id)
    if not allow_ids:
        allow_ids = None
    retrieved = retrieve(store, embedder, last_user, top_k=top_k, allow_document_ids=allow_ids)
    context = build_context_snippets(retrieved)

    sys_prompt = system_prompt_guidance()
    user_prompt = f"User question:\n{last_user}\n\nContext sources:\n{context}\n\nAnswer with citations as [n]."

    provider_cfg = replace(cfg, chat_provider=(req.chat_provider or cfg.chat_provider).lower())
    provider = get_chat_provider(provider_cfg)
    model = (req.chat_model or cfg.chat_model).strip() or cfg.chat_model
    temperature = req.temperature if req.temperature is not None else cfg.temperature

    def iter_events() -> Generator[bytes, None, None]:
        try:
            acc = ""
            try:
                for delta in provider.stream(
                    messages=[
                        {"role": "system", "content": sys_prompt},
                        *[{"role": m.role, "content": m.content} for m in req.messages if m.role != "system"],
                        {"role": "user", "content": user_prompt},
                    ],
                    model=model,
                    temperature=temperature,
                    max_tokens=cfg.max_tokens,
                    top_p=cfg.top_p,
                    presence_penalty=cfg.presence_penalty,
                    frequency_penalty=cfg.frequency_penalty,
                ):
                    acc += delta or ""
                    payload = {"type": "delta", "content": delta}
                    yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n".encode("utf-8")
            except Exception:
                # Try fallback as non-stream complete
                fb_provider = cfg.fallback_chat_provider
                fb_model = cfg.fallback_chat_model
                if fb_provider and fb_model:
                    fb_cfg = replace(cfg, chat_provider=fb_provider)
                    fb = get_chat_provider(fb_cfg)
                    acc = fb.complete(
                        messages=[
                            {"role": "system", "content": sys_prompt},
                            *[{"role": m.role, "content": m.content} for m in req.messages if m.role != "system"],
                            {"role": "user", "content": user_prompt},
                        ],
                        model=fb_model,
                        temperature=temperature,
                    )
                else:
                    raise
        except Exception as e:
            err = {"type": "error", "message": str(e)}
            yield f"data: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
        # after stream, send citations and prompt
        citations: List[Citation] = []
        for idx, (cr, _score) in enumerate(retrieved, start=1):
            name = cr.metadata.get("name") if isinstance(cr.metadata, dict) else cr.document_id
            page = None
            if isinstance(cr.metadata, dict):
                p = cr.metadata.get("page")
                if isinstance(p, int):
                    page = p
            citations.append(Citation(name=name, page=page))

        # Log the chat message and include answer_id
        store = get_chat_store(cfg)
        answer_id = store.insert_chat_message(
            user_id=current_user.id,
            question=last_user,
            answer=acc,
            citations=[c.dict() for c in citations],
            used_prompt=sys_prompt,
        )

        final = {"type": "done", "citations": [c.dict() for c in citations], "used_prompt": sys_prompt, "answer_id": answer_id}
        yield f"data: {json.dumps(final, ensure_ascii=False)}\n\n".encode("utf-8")

    return StreamingResponse(iter_events(), media_type="text/event-stream")
