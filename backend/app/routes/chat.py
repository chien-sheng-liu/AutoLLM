from typing import List, Generator, Literal

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
import json
from pydantic import BaseModel, Field
from ..config import load_config
from ..models.chat import ChatRequest, ChatResponse, Citation, Message as MessageModel
from ..models.intent import IntentResult
from ..services.embeddings import EmbeddingService
from ..services.rag import retrieve, build_context_snippets
from ..storage.vector_redis_store import RedisVectorStore
from ..storage.chat_store import get_chat_store
from ..storage.conv_pg_store import get_conv_pg_store
from ..storage.conversation_store import get_conversation_store
from ..services.agents import AgentPipeline
from ..services.agents.registry import AgentRegistry
from ..services.providers.base import ProviderError
from ..dependencies.auth import get_current_user, require_admin
from ..models.auth import UserOut
from dataclasses import replace
from ..storage.user_store import get_user_store
from ..services.rate_limit import check_rate_limit


class ConversationMessagePayload(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(..., min_length=1)


class ConversationPayload(BaseModel):
    id: str = Field(..., min_length=1, max_length=128)
    title: str = Field(..., min_length=1, max_length=200)
    messages: List[ConversationMessagePayload] = Field(default_factory=list)
    created_at: int = Field(..., alias="createdAt")
    updated_at: int = Field(..., alias="updatedAt")
    series: int | None = None

    class Config:
        populate_by_name = True


class ConversationListPayload(BaseModel):
    items: List[ConversationPayload] = Field(default_factory=list)

    class Config:
        populate_by_name = True


class ConversationCreate(BaseModel):
    title: str | None = None


class ConversationUpdate(BaseModel):
    title: str


router = APIRouter(
    prefix="/api/v1",
    tags=["chat"],
    dependencies=[Depends(get_current_user)],
)


class ReasoningDebugRequest(BaseModel):
    question: str
    conversation_history: list = []


@router.post("/chat/debug/reasoning")
def debug_reasoning(req: ReasoningDebugRequest, _: str = Depends(require_admin)):
    """
    Debug endpoint: run ReasoningAgent and return the raw intent analysis result.
    Admin only. Useful for testing prompt tuning without sending a full chat.
    """
    cfg = load_config()
    from ..services.agents.registry import AgentRegistry
    agent = AgentRegistry.get("reasoning")
    result = agent.execute(
        {"question": req.question, "conversation_history": req.conversation_history},
        cfg,
    )
    intent = result.data
    return {
        "intent_type": intent.intent_type,
        "keywords": intent.keywords,
        "needs_rag": intent.needs_rag,
        "language": intent.language,
        "complexity": intent.complexity,
        "blocked": intent.blocked,
        "blocked_reason": intent.blocked_reason,
        "route": intent.route,
        "raw_analysis": intent.raw_analysis,
        "fallback_used": result.metadata.get("fallback", False),
    }


# ---------------------------------------------------------------------------
# Shared helpers (extracted to eliminate duplication between chat / stream)
# ---------------------------------------------------------------------------

def _extract_last_user_message(messages) -> str:
    """Return the content of the most recent user-role message."""
    for m in reversed(messages):
        role = m.role if hasattr(m, "role") else m.get("role", "")
        if role == "user":
            content = m.content if hasattr(m, "content") else m.get("content", "")
            return content
    return ""


def _retrieve_context(cfg, user_id: str, auth: str, query: str, top_k: int, scope_document_ids: list[str] | None = None):
    """Run RAG retrieval (Redis first, Postgres fallback). Returns (retrieved, context_str)."""
    user_store = get_user_store(cfg)
    allow_ids = user_store.get_user_allowed_docs(user_id)
    if auth in ("admin", "administrator"):
        allow_ids = None
    elif not allow_ids:
        allow_ids = None

    # Apply user-selected document scope: intersect with permission-based allow_ids
    if scope_document_ids is not None:
        if allow_ids is None:
            # admin or no restrictions: scope directly
            allow_ids = scope_document_ids if scope_document_ids else None
        else:
            # intersection — never bypass permission restrictions
            allow_set = set(allow_ids)
            allow_ids = [d for d in scope_document_ids if d in allow_set] or None

    store = RedisVectorStore(cfg)
    embedder = EmbeddingService.from_config(cfg)
    retrieved = retrieve(store, embedder, query, top_k=top_k, allow_document_ids=allow_ids)

    if not retrieved:
        from ..storage.vector_store import VectorStore as PgVS
        try:
            pg_store = PgVS(cfg)
            retrieved = retrieve(pg_store, embedder, query, top_k=top_k, allow_document_ids=allow_ids)
        except Exception:
            pass

    context = build_context_snippets(retrieved)
    return retrieved, context


def _build_citations(retrieved) -> List[Citation]:
    citations: List[Citation] = []
    for _idx, (cr, _score) in enumerate(retrieved, start=1):
        name = cr.metadata.get("name") if isinstance(cr.metadata, dict) else cr.document_id
        page = None
        if isinstance(cr.metadata, dict):
            p = cr.metadata.get("page")
            if isinstance(p, int):
                page = p
        raw = getattr(cr, "text", None) or ""
        snippet = (raw[:300] + "…") if len(raw) > 300 else raw or None
        citations.append(Citation(name=name, page=page, text=snippet))
    return citations


def _persist_conversation(cfg, user_id: str, messages, conv_id, question: str, answer: str, citations: list | None = None):
    """Persist conversation + messages to Postgres and Redis cache. Returns conv dict."""
    conv_store = get_conv_pg_store(cfg)
    conv = conv_store.get_or_create_conversation(
        user_id=user_id,
        conversation_id=conv_id,
        title=title_from_first_user_message(messages),
    )
    cache = get_conversation_store(cfg)

    # Auto-rename conversation from first user message
    try:
        suggested = title_from_first_user_message(
            [m.dict() for m in messages] if hasattr(messages[0], "dict")
            else [{"role": m.role if hasattr(m, "role") else m.get("role"), "content": m.content if hasattr(m, "content") else m.get("content")} for m in messages]
        )
    except Exception:
        suggested = title_from_first_user_message([])

    current_title = str(conv.get("title") or "")
    if suggested and (not current_title or current_title.strip() == "新的對話"):
        try:
            renamed = conv_store.rename_conversation(user_id=user_id, conversation_id=conv["id"], title=suggested)
            if renamed:
                conv = renamed
                from datetime import datetime as _dt
                def to_ms(txt: str) -> int:
                    dt = _dt.fromisoformat(txt.replace("Z", "+00:00"))
                    return int(dt.timestamp() * 1000)
                s = conv.get("series")
                cache.upsert_conversation_meta(user_id, conv["id"], conv["title"], to_ms(conv["created_at"]), to_ms(conv["updated_at"]), series=int(s) if s is not None else None)
        except Exception:
            pass

    conv_store.append_message(user_id=user_id, conversation_id=conv["id"], role="user", content=question)
    cache.append_message(user_id, conv["id"], "user", question)
    conv_store.append_message(user_id=user_id, conversation_id=conv["id"], role="assistant", content=answer, citations=citations)
    cache.append_message(user_id, conv["id"], "assistant", answer, citations=citations)

    # Bump Redis updatedAt index
    try:
        from datetime import datetime as _dt
        now_ms = int(_dt.utcnow().timestamp() * 1000)
        s = conv.get("series")
        cache.upsert_conversation_meta(user_id, conv["id"], conv.get("title") or "新的對話", None, now_ms, series=int(s) if s is not None else None)
    except Exception:
        pass

    return conv


# ---------------------------------------------------------------------------
# Chat endpoints
# ---------------------------------------------------------------------------

@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, current_user: UserOut = Depends(get_current_user)):
    cfg = load_config()
    try:
        check_rate_limit(cfg, current_user.id, scope="chat", limit=60, window_seconds=60)
    except HTTPException:
        raise

    if not req.messages:
        raise HTTPException(status_code=422, detail="messages must not be empty")
    last_user = _extract_last_user_message(req.messages)
    if not last_user:
        raise HTTPException(status_code=422, detail="no user message provided")

    auth = (getattr(current_user, "auth", "user") or "user").lower()
    top_k = req.top_k or cfg.top_k
    provider_cfg = replace(cfg, chat_provider=(req.chat_provider or cfg.chat_provider).lower())
    model = (req.chat_model or cfg.chat_model).strip() or cfg.chat_model
    temperature = req.temperature if req.temperature is not None else cfg.temperature

    retrieved: list = []

    # Resolve document scope: request-level overrides persisted conversation scope
    scope_doc_ids: list[str] | None = req.document_ids
    if scope_doc_ids is None and req.conversation_id:
        try:
            pg = get_conv_pg_store(provider_cfg)
            scope_doc_ids = pg.get_document_scope(user_id=current_user.id, conversation_id=req.conversation_id)
        except Exception:
            pass

    def rag_hook(context: dict) -> None:
        nonlocal retrieved
        retrieved, ctx_str = _retrieve_context(provider_cfg, current_user.id, auth, last_user, top_k, scope_document_ids=scope_doc_ids)
        context["context"] = ctx_str

    pipeline_input: dict = {
        "question": last_user,
        "conversation_history": [{"role": m.role, "content": m.content} for m in req.messages],
        "messages": [{"role": m.role, "content": m.content} for m in req.messages],
        "model": model,
        "temperature": temperature,
        "context": "",
    }

    try:
        result = AgentPipeline(pre_answer_hook=rag_hook).run(pipeline_input, provider_cfg)
    except Exception:
        raise HTTPException(status_code=502, detail="chat_failed")

    answer: str = result.get("answer", "")
    citations = _build_citations(retrieved)
    citations_dicts = [c.dict() for c in citations]

    conv = _persist_conversation(provider_cfg, current_user.id, req.messages, req.conversation_id, last_user, answer, citations=citations_dicts)
    store = get_chat_store(provider_cfg)
    answer_id = store.insert_chat_message(
        user_id=current_user.id,
        question=last_user,
        answer=answer,
        citations=citations_dicts,
        used_prompt="",
    )

    return ChatResponse(answer=answer, citations=citations, used_prompt="", answer_id=answer_id)


@router.post("/chat/stream")
def chat_stream(req: ChatRequest, current_user: UserOut = Depends(get_current_user)):
    cfg = load_config()
    try:
        check_rate_limit(cfg, current_user.id, scope="chat", limit=60, window_seconds=60)
    except HTTPException:
        raise

    if not req.messages:
        raise HTTPException(status_code=422, detail="messages must not be empty")
    last_user = _extract_last_user_message(req.messages)
    if not last_user:
        raise HTTPException(status_code=422, detail="no user message provided")

    auth = (getattr(current_user, "auth", "user") or "user").lower()
    top_k = req.top_k or cfg.top_k
    provider_cfg = replace(cfg, chat_provider=(req.chat_provider or cfg.chat_provider).lower())
    model = (req.chat_model or cfg.chat_model).strip() or cfg.chat_model
    temperature = req.temperature if req.temperature is not None else cfg.temperature

    retrieved: list = []

    # Resolve document scope: request-level overrides persisted conversation scope
    scope_doc_ids: list[str] | None = req.document_ids
    if scope_doc_ids is None and req.conversation_id:
        try:
            pg_pre = get_conv_pg_store(provider_cfg)
            scope_doc_ids = pg_pre.get_document_scope(user_id=current_user.id, conversation_id=req.conversation_id)
        except Exception:
            pass

    def rag_hook(context: dict) -> None:
        nonlocal retrieved
        retrieved, ctx_str = _retrieve_context(provider_cfg, current_user.id, auth, last_user, top_k, scope_document_ids=scope_doc_ids)
        context["context"] = ctx_str

    pipeline_input: dict = {
        "question": last_user,
        "conversation_history": [{"role": m.role, "content": m.content} for m in req.messages],
        "messages": [{"role": m.role, "content": m.content} for m in req.messages],
        "model": model,
        "temperature": temperature,
        "context": "",
    }

    def iter_events() -> Generator[bytes, None, None]:
        acc = ""

        # Persist conversation + initial user message before streaming
        conv_store = get_conv_pg_store(provider_cfg)
        conv = conv_store.get_or_create_conversation(
            user_id=current_user.id,
            conversation_id=req.conversation_id,
            title=title_from_first_user_message(req.messages),
        )
        cache = get_conversation_store(provider_cfg)
        try:
            suggested = title_from_first_user_message(
                [m.dict() for m in req.messages] if hasattr(req.messages[0], "dict")
                else [{"role": m.role, "content": m.content} for m in req.messages]
            )
        except Exception:
            suggested = title_from_first_user_message([])
        current_title = str(conv.get("title") or "")
        if suggested and (not current_title or current_title.strip() == "新的對話"):
            try:
                renamed = conv_store.rename_conversation(user_id=current_user.id, conversation_id=conv["id"], title=suggested)
                if renamed:
                    conv = renamed
                    from datetime import datetime as _dt
                    def to_ms(txt: str) -> int:
                        dt = _dt.fromisoformat(txt.replace("Z", "+00:00"))
                        return int(dt.timestamp() * 1000)
                    s = conv.get("series")
                    cache.upsert_conversation_meta(current_user.id, conv["id"], conv["title"], to_ms(conv["created_at"]), to_ms(conv["updated_at"]), series=int(s) if s is not None else None)
            except Exception:
                pass
        conv_store.append_message(user_id=current_user.id, conversation_id=conv["id"], role="user", content=last_user)
        cache.append_message(current_user.id, conv["id"], "user", last_user)

        # Stream via pipeline (reasoning sync → rag hook → sub-agent stream)
        for event in AgentPipeline(pre_answer_hook=rag_hook).run_stream(pipeline_input, provider_cfg):
            if event.type == "delta":
                delta = event.payload or ""
                acc += delta
                payload = {"type": "delta", "content": delta}
                yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n".encode("utf-8")
            elif event.type == "error":
                err = {"type": "error", **(event.payload if isinstance(event.payload, dict) else {"message": str(event.payload)})}
                yield f"data: {json.dumps(err, ensure_ascii=False)}\n\n".encode("utf-8")
                return
            # "done" event: fall through to finalization below

        # Finalize: persist assistant message + emit citations
        citations = _build_citations(retrieved)
        citations_dicts = [c.dict() for c in citations]
        try:
            conv_store.append_message(user_id=current_user.id, conversation_id=conv["id"], role="assistant", content=acc, citations=citations_dicts)
            cache.append_message(current_user.id, conv["id"], "assistant", acc, citations=citations_dicts)
        except Exception:
            pass
        try:
            from datetime import datetime as _dt
            now_ms = int(_dt.utcnow().timestamp() * 1000)
            s = conv.get("series")
            cache.upsert_conversation_meta(current_user.id, conv["id"], conv.get("title") or "新的對話", None, now_ms, series=int(s) if s is not None else None)
        except Exception:
            pass

        store = get_chat_store(provider_cfg)
        answer_id = store.insert_chat_message(
            user_id=current_user.id,
            question=last_user,
            answer=acc,
            citations=[c.dict() for c in citations],
            used_prompt="",
        )

        final = {"type": "done", "citations": [c.dict() for c in citations], "used_prompt": "", "answer_id": answer_id}
        yield f"data: {json.dumps(final, ensure_ascii=False)}\n\n".encode("utf-8")

    return StreamingResponse(iter_events(), media_type="text/event-stream")


def title_from_first_user_message(msgs) -> str:
    try:
        for m in msgs:
            role = (m.get("role") if isinstance(m, dict) else getattr(m, "role", "")).lower()
            content = (m.get("content") if isinstance(m, dict) else getattr(m, "content", "")) or ""
            if role == "user":
                t = str(content).strip().split("\n")[0]
                return (t[:40] + ("…" if len(t) > 40 else "")) or "新的對話"
    except Exception:
        pass
    return "新的對話"


@router.get("/chat/conversations", response_model=ConversationListPayload)
def list_conversations(current_user: UserOut = Depends(get_current_user)):
    cfg = load_config()
    store = get_conversation_store(cfg)
    items = store.get_conversations(current_user.id)
    return ConversationListPayload(items=items or [])


@router.put("/chat/conversations", response_model=ConversationListPayload)
def save_conversations(payload: ConversationListPayload, current_user: UserOut = Depends(get_current_user)):
    cfg = load_config()
    store = get_conversation_store(cfg)
    serialized = payload.model_dump(by_alias=True)
    store.save_conversations(current_user.id, serialized.get("items", []))
    return payload


class MessagesResponse(BaseModel):
    messages: List[MessageModel]


@router.get("/chat/conversations/{conversation_id}", response_model=MessagesResponse)
def get_conversation_messages(conversation_id: str, current_user: UserOut = Depends(get_current_user)):
    cfg = load_config()
    cache = get_conversation_store(cfg)
    raw = cache.get_messages(current_user.id, conversation_id)

    # Fall back to Postgres if Redis cache is empty (expired or first load)
    if not raw:
        try:
            pg = get_conv_pg_store(cfg)
            raw = pg.get_messages(user_id=current_user.id, conversation_id=conversation_id)
        except Exception:
            raw = []

    msgs: List[MessageModel] = []
    for r in raw:
        role = (str(r.get("role")) or "assistant").lower()
        content = str(r.get("content") or "")
        if role not in ("system", "user", "assistant") or not content:
            continue
        citations_raw = r.get("citations")
        citations: List[Citation] | None = None
        if citations_raw and isinstance(citations_raw, list):
            try:
                citations = [Citation(**c) for c in citations_raw if isinstance(c, dict)]
            except Exception:
                citations = None
        msgs.append(MessageModel(role=role, content=content, citations=citations or None))
    return MessagesResponse(messages=msgs)


@router.post("/chat/conversations")
def create_conversation(payload: ConversationCreate, current_user: UserOut = Depends(get_current_user)):
    cfg = load_config()
    try:
        check_rate_limit(cfg, current_user.id, scope="conv", limit=30, window_seconds=60)
    except HTTPException:
        raise
    pg = get_conv_pg_store(cfg)
    store = get_conversation_store(cfg)
    row = pg.create_conversation(user_id=current_user.id, title=(payload.title or "新的對話"))
    from datetime import datetime
    try:
        def to_ms(txt: str) -> int:
            dt = datetime.fromisoformat(txt.replace("Z", "+00:00"))
            return int(dt.timestamp() * 1000)
        s = row.get("series")
        store.upsert_conversation_meta(current_user.id, row["id"], row["title"], to_ms(row["created_at"]), to_ms(row["updated_at"]), series=int(s) if s is not None else None)
    except Exception:
        pass
    return {"id": row["id"], "title": row["title"], "series": int(row.get("series") or 0)}


@router.put("/chat/conversations/{conversation_id}")
def rename_conversation(conversation_id: str, payload: ConversationUpdate, current_user: UserOut = Depends(get_current_user)):
    cfg = load_config()
    try:
        check_rate_limit(cfg, current_user.id, scope="conv", limit=60, window_seconds=60)
    except HTTPException:
        raise
    pg = get_conv_pg_store(cfg)
    store = get_conversation_store(cfg)
    row = pg.rename_conversation(user_id=current_user.id, conversation_id=conversation_id, title=payload.title)
    if not row:
        raise HTTPException(status_code=404, detail="Conversation not found")
    from datetime import datetime
    try:
        def to_ms(txt: str) -> int:
            dt = datetime.fromisoformat(txt.replace("Z", "+00:00"))
            return int(dt.timestamp() * 1000)
        s = row.get("series")
        store.upsert_conversation_meta(current_user.id, row["id"], row["title"], to_ms(row["created_at"]), to_ms(row["updated_at"]), series=int(s) if s is not None else None)
    except Exception:
        pass
    return {"ok": True}


@router.delete("/chat/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, current_user: UserOut = Depends(get_current_user), series: int | None = None):
    cfg = load_config()
    try:
        check_rate_limit(cfg, current_user.id, scope="conv", limit=30, window_seconds=60)
    except HTTPException:
        raise
    pg = get_conv_pg_store(cfg)
    store = get_conversation_store(cfg)
    if series is not None:
        cid = store.get_conversation_id_by_series(current_user.id, int(series))
        if cid:
            conversation_id = cid
    ok = pg.delete_conversation(user_id=current_user.id, conversation_id=conversation_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Conversation not found")
    try:
        store.delete_conversation_meta(current_user.id, conversation_id)
        store.delete_messages(current_user.id, conversation_id)
    except Exception:
        pass
    return {"ok": True}


@router.delete("/chat/conversations/by-series/{series}")
def delete_conversation_by_series(series: int, current_user: UserOut = Depends(get_current_user)):
    cfg = load_config()
    try:
        check_rate_limit(cfg, current_user.id, scope="conv", limit=30, window_seconds=60)
    except HTTPException:
        raise
    pg = get_conv_pg_store(cfg)
    store = get_conversation_store(cfg)
    cid = store.get_conversation_id_by_series(current_user.id, int(series))
    if not cid:
        raise HTTPException(status_code=404, detail="Conversation not found")
    ok = pg.delete_conversation(user_id=current_user.id, conversation_id=cid)
    if not ok:
        raise HTTPException(status_code=404, detail="Conversation not found")
    try:
        store.delete_conversation_meta(current_user.id, cid)
        store.delete_messages(current_user.id, cid)
    except Exception:
        pass
    return {"ok": True}


@router.post("/chat/conversations/migrate")
def migrate_legacy_conversations(current_user: UserOut = Depends(get_current_user)):
    cfg = load_config()
    try:
        check_rate_limit(cfg, current_user.id, scope="migrate", limit=3, window_seconds=3600)
    except HTTPException:
        raise
    legacy = get_conversation_store(cfg).get_conversations(current_user.id)
    pg = get_conv_pg_store(cfg)
    migrated = 0
    for item in legacy:
        try:
            cid = str(item.get("id") or "").strip()
            title = str(item.get("title") or "新的對話")
            conv = pg.get_or_create_conversation(user_id=current_user.id, conversation_id=cid or None, title=title)
            msgs = item.get("messages") or []
            for m in msgs:
                role = str(m.get("role") or "").lower()
                content = str(m.get("content") or "")
                if role in ("system", "user", "assistant") and content:
                    pg.append_message(user_id=current_user.id, conversation_id=conv["id"], role=role, content=content)
            migrated += 1
        except Exception:
            continue
    return {"ok": True, "migrated": migrated}


# ---------------------------------------------------------------------------
# Document scope endpoints
# ---------------------------------------------------------------------------

class DocumentScopePayload(BaseModel):
    document_ids: List[str] | None = None


@router.get("/chat/conversations/{conversation_id}/documents")
def get_conversation_document_scope(conversation_id: str, current_user: UserOut = Depends(get_current_user)):
    """Return the document IDs scoped for this conversation (None = all documents)."""
    cfg = load_config()
    pg = get_conv_pg_store(cfg)
    doc_ids = pg.get_document_scope(user_id=current_user.id, conversation_id=conversation_id)
    return {"document_ids": doc_ids}


@router.put("/chat/conversations/{conversation_id}/documents")
def set_conversation_document_scope(
    conversation_id: str,
    payload: DocumentScopePayload,
    current_user: UserOut = Depends(get_current_user),
):
    """Set or clear the document scope for this conversation."""
    cfg = load_config()
    pg = get_conv_pg_store(cfg)

    # Validate: each requested ID must exist in documents the user can access
    if payload.document_ids is not None:
        from ..storage.user_store import get_user_store as _get_user_store
        user_store = _get_user_store(cfg)
        auth = (getattr(current_user, "auth", "user") or "user").lower()
        if auth not in ("admin", "administrator"):
            allowed = user_store.get_user_allowed_docs(current_user.id)
            if allowed is not None:
                allowed_set = set(allowed)
                invalid = [d for d in payload.document_ids if d not in allowed_set]
                if invalid:
                    raise HTTPException(status_code=403, detail="One or more document IDs are not accessible")

    ok = pg.set_document_scope(
        user_id=current_user.id,
        conversation_id=conversation_id,
        document_ids=payload.document_ids,
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"ok": True}
