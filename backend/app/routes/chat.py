from typing import List, Generator, Literal

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
import json
from pydantic import BaseModel, Field
from ..config import load_config
from ..models.chat import ChatRequest, ChatResponse, Citation, Message as MessageModel
from ..services.embeddings import EmbeddingService
from ..services.rag import retrieve, build_context_snippets, system_prompt_guidance
from ..storage.vector_store import VectorStore
from ..storage.vector_redis_store import RedisVectorStore
from ..storage.chat_store import get_chat_store
from ..storage.conv_pg_store import get_conv_pg_store
from ..storage.conversation_store import get_conversation_store
from ..services.providers.factory import get_chat_provider
from ..dependencies.auth import get_current_user
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


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, current_user: UserOut = Depends(get_current_user)):
    cfg = load_config()
    # rate limit per-user
    try:
        check_rate_limit(cfg, current_user.id, scope="chat", limit=60, window_seconds=60)
    except HTTPException:
        raise
    # Provider will validate corresponding API key

    top_k = req.top_k or cfg.top_k
    # Retrieval must read from Redis; Postgres remains audit/log only
    store = RedisVectorStore(cfg)
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
    auth = (getattr(current_user, 'auth', 'user') or 'user').lower()
    if auth in ('admin', 'administrator'):
        allow_ids = None
    elif not allow_ids:
        # No explicit permissions set -> do not allow cross-user access
        allow_ids = []
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

    # Persist conversation + messages
    conv_store = get_conv_pg_store(cfg)
    conv = conv_store.get_or_create_conversation(user_id=current_user.id, conversation_id=req.conversation_id, title=title_from_first_user_message(req.messages))
    cache = get_conversation_store(cfg)
    # Auto-name conversation from the first user message if title is default/empty
    try:
        suggested = title_from_first_user_message([m.dict() for m in req.messages]) if hasattr(req.messages[0], 'dict') else title_from_first_user_message([{"role": m.role, "content": m.content} for m in req.messages])
    except Exception:
        suggested = title_from_first_user_message([])
    current_title = str(conv.get("title") or "")
    if suggested and (not current_title or current_title.strip() == "新的對話"):
        try:
            renamed = conv_store.rename_conversation(user_id=current_user.id, conversation_id=conv["id"], title=suggested)
            if renamed:
                # refresh conv ref
                conv = renamed  # type: ignore
                # update Redis index title
                from datetime import datetime
                def to_ms(txt: str) -> int:
                    from datetime import datetime as _dt
                    dt = _dt.fromisoformat(txt.replace("Z", "+00:00"))
                    return int(dt.timestamp() * 1000)
                s = conv.get("series")
                cache.upsert_conversation_meta(current_user.id, conv["id"], conv["title"], to_ms(conv["created_at"]), to_ms(conv["updated_at"]), series=int(s) if s is not None else None)
        except Exception:
            pass
    # append user and assistant messages to Postgres (audit) and Redis (cache)
    conv_store.append_message(user_id=current_user.id, conversation_id=conv["id"], role="user", content=last_user)
    cache.append_message(current_user.id, conv["id"], "user", last_user)
    conv_store.append_message(user_id=current_user.id, conversation_id=conv["id"], role="assistant", content=answer)
    cache.append_message(current_user.id, conv["id"], "assistant", answer)
    # bump Redis index updatedAt
    try:
        from datetime import datetime as _dt
        now_ms = int(_dt.utcnow().timestamp() * 1000)
        s = conv.get("series")
        cache.upsert_conversation_meta(current_user.id, conv["id"], conv.get("title") or "新的對話", None, now_ms, series=int(s) if s is not None else None)
    except Exception:
        pass

    # Log chat message and return answer_id (legacy table)
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
    try:
        check_rate_limit(cfg, current_user.id, scope="chat", limit=60, window_seconds=60)
    except HTTPException:
        raise
    # Provider will validate corresponding API key

    top_k = req.top_k or cfg.top_k
    # Retrieval must read from Redis; Postgres remains audit/log only
    store = RedisVectorStore(cfg)
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
    auth = (getattr(current_user, 'auth', 'user') or 'user').lower()
    if auth in ('admin', 'administrator'):
        allow_ids = None
    elif not allow_ids:
        allow_ids = []
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
            # persist conversation + the initial user message
            conv_store = get_conv_pg_store(cfg)
            conv = conv_store.get_or_create_conversation(user_id=current_user.id, conversation_id=req.conversation_id, title=title_from_first_user_message(req.messages))
            cache = get_conversation_store(cfg)
            # Auto-name from first user message if needed
            try:
                suggested = title_from_first_user_message([m.dict() for m in req.messages]) if hasattr(req.messages[0], 'dict') else title_from_first_user_message([{"role": m.role, "content": m.content} for m in req.messages])
            except Exception:
                suggested = title_from_first_user_message([])
            current_title = str(conv.get("title") or "")
            if suggested and (not current_title or current_title.strip() == "新的對話"):
                try:
                    renamed = conv_store.rename_conversation(user_id=current_user.id, conversation_id=conv["id"], title=suggested)
                    if renamed:
                        conv = renamed  # type: ignore
                        from datetime import datetime
                        def to_ms(txt: str) -> int:
                            from datetime import datetime as _dt
                            dt = _dt.fromisoformat(txt.replace("Z", "+00:00"))
                            return int(dt.timestamp() * 1000)
                        s = conv.get("series")
                        cache.upsert_conversation_meta(current_user.id, conv["id"], conv["title"], to_ms(conv["created_at"]), to_ms(conv["updated_at"]), series=int(s) if s is not None else None)
                except Exception:
                    pass
            conv_store.append_message(user_id=current_user.id, conversation_id=conv["id"], role="user", content=last_user)
            cache.append_message(current_user.id, conv["id"], "user", last_user)
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

        # Persist assistant message in Postgres conversation messages
        try:
            conv_store.append_message(user_id=current_user.id, conversation_id=conv["id"], role="assistant", content=acc)
            cache.append_message(current_user.id, conv["id"], "assistant", acc)
        except Exception:
            pass
        # bump Redis index updatedAt
        try:
            from datetime import datetime as _dt
            now_ms = int(_dt.utcnow().timestamp() * 1000)
            s = conv.get("series")
            cache.upsert_conversation_meta(current_user.id, conv["id"], conv.get("title") or "新的對話", None, now_ms, series=int(s) if s is not None else None)
        except Exception:
            pass

        # Log the chat message and include answer_id (legacy table)
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


def title_from_first_user_message(msgs: list[dict]) -> str:
    try:
        for m in msgs:
            if (m.get("role") or "").lower() == "user":
                t = str(m.get("content") or "").strip().split("\n")[0]
                return (t[:40] + ("…" if len(t) > 40 else "")) or "新的對話"
    except Exception:
        pass
    return "新的對話"


@router.get("/chat/conversations", response_model=ConversationListPayload)
def list_conversations(current_user: UserOut = Depends(get_current_user)):
    cfg = load_config()
    store = get_conversation_store(cfg)
    items = store.get_conversations(current_user.id)
    # Serve Redis as the canonical UI list; do not resurrect deleted items from Postgres
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
    msgs: List[MessageModel] = []
    for r in raw:
        role = (str(r.get("role")) or "assistant").lower()
        content = str(r.get("content") or "")
        if role in ("system", "user", "assistant") and content:
            msgs.append(MessageModel(role=role, content=content))
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
    # update redis index
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
    # Allow deletion via series number if provided
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
