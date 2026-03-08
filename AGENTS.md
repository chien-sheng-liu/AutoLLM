# AGENT.md — AutoLLM Repository Guide for Codex / AI Coding Agents

> Purpose: This document is a **repo operating manual** for AI coding agents (Codex, Claude Code, Cursor, Copilot, etc.) working on `chien-sheng-liu/AutoLLM`. It explains the architecture, boundaries, conventions, data model expectations, runtime behavior, and safe ways to extend the system.
>
> Scope: Entire repository.

---

## 1. What this repo is

AutoLLM is a full-stack, no-code RAG chatbot platform built with:

- **Backend:** FastAPI (Python)
- **Frontend:** Next.js (TypeScript, App Router)
- **Primary DB:** PostgreSQL + pgvector
- **Cache / short-term chat store:** Redis
- **LLM providers:** OpenAI / Gemini / Anthropic (pluggable)

Core product goals:

1. Let users upload documents.
2. Parse, chunk, embed, and store them.
3. Let users ask questions over their uploaded knowledge base.
4. Return grounded answers with citations / provenance.
5. Maintain both short-term conversational context and long-term audit logs.

This repo is not just a demo. Treat it as a **production-oriented AI application skeleton** with authentication, provider abstraction, retrieval settings, chat APIs, persistent storage, and a UI for managing the full flow.

---

## 2. High-level architecture

### 2.1 System view

```text
Browser (Next.js frontend)
        ↓
FastAPI backend (/api/v1/*)
        ↓
 ┌───────────────────────────────┬───────────────────────────────┐
 │ PostgreSQL + pgvector         │ Redis                         │
 │ - users                       │ - temporary chat session      │
 │ - documents                   │   memory                      │
 │ - chunks                      │ - frontend reads recent       │
 │ - embeddings                  │   messages from here          │
 │ - persistent chat logs        │ - TTL: 3 days                 │
 │   (audit / compliance / log)  │                               │
 └───────────────────────────────┴───────────────────────────────┘
```

### 2.2 Important storage split

This repo has **two chat-history layers**, and agents must preserve that distinction:

#### Redis = temporary conversational memory
- Used as a **short-term chat session store**.
- The **frontend reads recent conversation state from Redis**.
- Data is **ephemeral**.
- TTL is **3 days**.
- Optimize for speed, low latency, recent context, and UX continuity.
- Do **not** treat Redis as the system of record.

#### PostgreSQL = permanent audit and logs
- Stores **persistent chat records**.
- Used for **audit trail**, **logging**, and long-term record retention.
- PostgreSQL is the **durable system of record** for historical chat data.
- Do not implement features that rely on Redis as the only source of truth for compliance, traceability, or permanent reporting.

When implementing anything related to chat history, always ask:

- Is this for **recent UX/session continuity**? → Redis
- Is this for **permanent record / audit / analytics / compliance**? → PostgreSQL

---

## 3. Product capabilities

Agents should understand the user-facing capabilities before changing code.

### 3.1 Document ingestion
Users can upload supported files (currently README/AGENTS mention `.txt` and `.pdf` flows explicitly). The backend should:

1. receive file upload,
2. parse content,
3. split content into chunks,
4. generate embeddings,
5. write document metadata + chunks + vectors to PostgreSQL/pgvector.

### 3.2 Retrieval-Augmented Generation (RAG)
For each chat request, the system should:

1. embed the user query,
2. retrieve top-K relevant chunks,
3. construct grounded context,
4. call the selected chat provider,
5. return answer + citations.

### 3.3 Provenance / citations
Every grounded answer should expose provenance, including fields like:

- `document_id`
- `name`
- `chunk_id`
- `score`
- `snippet`

When extending response schemas, never remove provenance unless explicitly required.

### 3.4 Configurable retrieval
Users can tune RAG behavior from the Settings UI, such as:

- chunk size
- chunk overlap
- top-k
- chat model
- embedding model
- provider selection / health

### 3.5 Authenticated app experience
The app includes:

- registration
- login
- session handling with JWT
- protected pages and protected backend endpoints

Any new feature should respect the existing auth model.

---

## 4. Repository mental model

Use this mental model when reading or editing the codebase.

```text
backend/
  app/
    main.py                # FastAPI app bootstrap
    config.py              # environment/config loading
    models/                # Pydantic request/response models
    routes/                # API routers
    services/              # business logic
    dependencies/          # auth dependencies and cross-cutting concerns
    storage/               # persistence layer abstractions / DB access
  data/                    # runtime local data directory
  requirements.txt

frontend/
  app/                     # App Router pages
  lib/                     # API client and session helpers
  package.json
  tsconfig.json
  next.config.js

docker-compose.yml         # backend + frontend + postgres + redis
.env.example               # env contract
README.md                  # product-level overview
AGENTS.md                  # earlier repo instructions
```

---

## 5. Backend responsibilities

The backend should remain the **source of business logic**. Do not move core decision logic into the frontend.

### 5.1 API layer
The API is mounted under `/api/v1/*`.

Expected route groups include:

- `auth`
- `docs`
- `chat`
- `config`
- `providers`

### 5.2 Services layer
Keep orchestration and business rules in services, not routers.

Typical service concerns:

- provider selection
- embedding generation
- chunking strategy
- retrieval orchestration
- prompt assembly
- citation packaging
- chat persistence
- Redis session writes / reads
- audit log writes to PostgreSQL

### 5.3 Storage layer
Storage modules should encapsulate persistence details.

Typical responsibilities:

- document CRUD
- chunk storage
- embedding writes / similarity query
- user storage
- chat log storage
- Redis session access

When adding new persistence-related logic, prefer extending storage/service layers instead of writing raw DB code inside route handlers.

---

## 6. Frontend responsibilities

The frontend is a product UI, not the source of truth.

### 6.1 Primary pages
Expected UX areas include:

- Home
- Login / Register
- Data
- Chat
- Settings

### 6.2 Frontend chat behavior
The frontend should:

- authenticate via JWT,
- call backend APIs via `NEXT_PUBLIC_API_BASE_URL`,
- display recent chat context,
- display streaming or synchronous answers,
- render citations,
- use Redis-backed recent chat state for immediate UX continuity.

### 6.3 Session behavior
Existing repo guidance indicates the frontend stores session state with localStorage/cookie patterns and clears session on `401`.

When modifying frontend auth:
- keep unauthorized behavior predictable,
- redirect users cleanly,
- avoid silent auth failures,
- do not leak tokens into logs or UI.

---

## 7. Canonical runtime behavior for chat

Agents should treat the following sequence as the intended reference flow.

### 7.1 Chat request flow

1. User sends a message from the frontend.
2. Frontend includes JWT and conversation/session identifiers as needed.
3. Backend validates auth.
4. Backend optionally loads recent context from Redis.
5. Backend embeds the query.
6. Backend retrieves relevant chunks from PostgreSQL + pgvector.
7. Backend builds the grounded prompt.
8. Backend calls the selected provider.
9. Backend returns answer + citations.
10. Backend writes ephemeral session state to Redis.
11. Backend writes permanent audit/log record to PostgreSQL.
12. Frontend displays answer and citations.

### 7.2 Streaming behavior
If using `/api/v1/chat/stream`, preserve a stable event protocol such as:

- `delta`
- `done`
- `error`

If you extend stream payloads, do so backward-compatibly.

---

## 8. Data ownership rules

These rules are critical.

### 8.1 Redis rules
Use Redis for:
- recent messages,
- temporary session context,
- fast resume UX,
- short-lived frontend-facing history.

Do not use Redis as the only storage for:
- legal/compliance history,
- audit trails,
- analytics-grade reporting,
- reconstructing the permanent history of user activity.

### 8.2 PostgreSQL rules
Use PostgreSQL for:
- users,
- documents,
- chunks,
- embeddings,
- configuration persistence where applicable,
- permanent chat logs,
- audit and long-term logging.

### 8.3 Retention expectation
If you introduce chat-history features, preserve the retention contract:

- Redis history expires after **3 days**.
- PostgreSQL audit logs persist until separately archived / deleted by explicit product policy.

Do not accidentally create a mismatch where the frontend depends on data that disappears sooner than expected, or where audit logs are silently skipped.

---

## 9. Suggested domain model

These entities are either directly present in repo docs or implied by architecture.

### 9.1 Users
Likely includes:
- id
- email
- password_hash
- name
- created_at
- updated_at

### 9.2 Documents
Likely includes:
- id
- user_id or owner reference
- filename / name
- original path / storage reference
- mime type
- created_at

### 9.3 Chunks
Likely includes:
- id
- document_id
- content
- chunk_index
- metadata JSON
- created_at

### 9.4 Embeddings
Likely includes:
- id
- chunk_id
- vector
- model
- created_at

### 9.5 Chat audit log (permanent)
Recommended conceptual shape:
- id
- user_id
- session_id
- message_role
- message_text
- provider
- model
- citations JSON
- prompt metadata
- created_at

### 9.6 Redis session object (temporary)
Recommended conceptual shape:
- session_id
- user_id
- recent_messages[]
- last_updated_at
- ttl_seconds = 259200

Agents may adapt the actual schema to the codebase, but they should preserve the conceptual separation.

---

## 10. API expectations

The repo documentation indicates these major endpoints.

### 10.1 Auth
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`

### 10.2 Documents
- `POST /api/v1/docs/upload`
- `GET /api/v1/docs`
- `DELETE /api/v1/docs/{document_id}`

### 10.3 Config
- `GET /api/v1/config`
- `PUT /api/v1/config`

### 10.4 Chat
- `POST /api/v1/chat`
- `POST /api/v1/chat/stream`

### 10.5 Provider health
- `GET /api/v1/providers/health`

When adding endpoints:
- stay under `/api/v1/*` unless you are intentionally introducing versioning,
- keep request/response models explicit,
- prefer additive changes over breaking changes.

---

## 11. Provider abstraction rules

This project is intentionally provider-pluggable.

### 11.1 Chat providers
Supported / intended providers include:
- OpenAI
- Gemini
- Anthropic

### 11.2 Embedding providers
At minimum, repo docs mention OpenAI and Gemini for embeddings.

### 11.3 Agent instruction
When implementing provider-specific changes:

1. Do not hardcode one provider deep inside business logic.
2. Keep provider selection centralized.
3. Normalize provider outputs into a stable internal shape.
4. Fail gracefully when API keys are missing.
5. Preserve provider health-check behavior.

### 11.4 Model changes
Model names may come from:
- `.env`
- settings UI
- backend config persistence

Do not assume a single static model.

---

## 12. RAG behavior defaults

Current documented defaults include:

- `chunk_size = 1000`
- `chunk_overlap = 200`
- `top_k = 4`
- default chat model example: `gpt-4o-mini`
- default embedding model example: `text-embedding-3-small`

Agents can improve defaults, but should:
- preserve configurability,
- avoid silently changing user-saved config,
- keep embedding dimensions aligned with the chosen embedding model.

---

## 13. Security and privacy rules

These are non-negotiable.

### 13.1 Never log secrets
Never log:
- API keys,
- JWT secrets,
- bearer tokens,
- raw authorization headers.

### 13.2 Minimize raw content exposure
Avoid logging raw document contents and raw chat contents unless explicitly required for audited debug mode.

### 13.3 Respect provenance without overexposure
Citations should expose enough for grounding and trust, but avoid returning excessive private text if only a snippet is needed.

### 13.4 Auth boundaries
All non-auth routes should require valid authentication unless a route is explicitly meant to be public.

### 13.5 File upload safety
When extending ingestion:
- validate file type,
- validate file size,
- handle encrypted PDFs safely,
- surface user-safe error messages.

---

## 14. Coding conventions

### 14.1 Python / FastAPI
- Use type hints.
- Use Pydantic models for API contracts.
- Keep route handlers thin.
- Put orchestration in services.
- Put persistence code in storage/repository-style modules.
- Return safe error messages to clients.

### 14.2 TypeScript / Next.js
- Use functional React components.
- Keep API access logic in `lib/`.
- Do not duplicate backend business rules in UI code.
- Prefer explicit types for API responses.

### 14.3 Naming
- Python: `snake_case`
- TypeScript variables/functions: `camelCase`
- Keep filenames aligned with framework expectations.

### 14.4 Backward compatibility
If changing API shapes used by the frontend, update both sides together and document the contract.

---

## 15. What agents should do before coding

Before modifying code, the agent should identify:

1. Is the change **frontend only**, **backend only**, or **cross-stack**?
2. Does it affect **Redis temporary history**, **PostgreSQL permanent history**, or both?
3. Does it affect **provider abstraction**?
4. Does it affect **auth**?
5. Does it affect **RAG quality** or **citation schema**?
6. Does it introduce a migration requirement?

If a migration is needed, the agent should state that clearly.

---

## 16. Safe change patterns

### 16.1 Good changes
Examples of safe changes:
- add provider adapter behind a stable interface,
- improve chunking while keeping config compatible,
- add extra metadata to citations,
- add Redis helper utilities without changing persistence semantics,
- add a PostgreSQL audit table for richer observability,
- improve upload validation,
- improve streaming UX without breaking event types.

### 16.2 Risky changes
Examples that require extra caution:
- replacing Redis with PostgreSQL for recent session reads,
- removing citations from chat responses,
- changing JWT handling,
- changing vector dimensions without migration strategy,
- changing document/chunk schema without updating retrieval,
- relying on Redis as the only history source,
- changing route names used by frontend pages.

---

## 17. Preferred implementation rules for chat history

Because chat history is split across Redis and PostgreSQL, agents should follow these design rules.

### 17.1 Write path
For every successful chat interaction, prefer:

- write / update recent session payload in Redis,
- append durable log record in PostgreSQL.

### 17.2 Read path
- Frontend-facing recent conversation load can come from Redis for speed.
- Historical review / audit / long-term analytics should come from PostgreSQL.

### 17.3 Recovery behavior
If Redis expires or is unavailable:
- the app should degrade gracefully,
- recent UX memory may be empty,
- permanent audit logs in PostgreSQL must remain intact.

### 17.4 TTL behavior
If implementing TTL, use the product rule:
- **3 days** = 72 hours = 259200 seconds.

Do not introduce a different TTL unless product requirements explicitly change.

---

## 18. Operational expectations

### 18.1 Docker services
The documented compose stack includes:
- backend
- frontend
- postgres
- redis

### 18.2 Environment variables
Important env areas include:

#### Providers
- `OPENAI_API_KEY`
- `GOOGLE_API_KEY` and/or `GEMINI_API_KEY`
- `ANTHROPIC_API_KEY`
- `CHAT_PROVIDER`
- `EMBEDDING_PROVIDER`
- provider-specific model names

#### RAG
- `RAG_CHUNK_SIZE`
- `RAG_CHUNK_OVERLAP`
- `RAG_TOP_K`
- `EMBEDDING_DIM`

#### PostgreSQL
- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`

#### Redis
- `REDIS_HOST`
- `REDIS_PORT`
- optional `REDIS_URL`

#### Auth
- `JWT_SECRET_KEY`
- `JWT_ALGORITHM`
- `JWT_EXPIRES_MINUTES`

#### Frontend
- `NEXT_PUBLIC_API_BASE_URL`

When adding new env vars:
- document them in `.env.example`,
- use sane defaults where safe,
- avoid introducing hidden required env vars.

---

## 19. Testing priorities for future work

If agents add tests, prioritize:

1. auth flow,
2. document upload flow,
3. chunk/embedding persistence,
4. retrieval correctness,
5. citation presence,
6. Redis session write/read + TTL behavior,
7. PostgreSQL permanent chat log writes,
8. provider health checks,
9. failure cases for missing keys / bad files / unauthorized requests.

---

## 20. Common tasks and how to think about them

### 20.1 “Add a new LLM provider”
Do:
- add adapter layer,
- normalize response schema,
- add env vars,
- add provider health support,
- update settings UI if needed.

Do not:
- hardwire provider calls into route handlers.

### 20.2 “Add conversation history page”
Do:
- decide whether the page is recent-session focused or audit focused,
- recent = Redis-backed cache path,
- historical = PostgreSQL-backed query path.

Do not:
- query Redis for permanent history expectations.

### 20.3 “Improve RAG answer quality”
Do:
- refine chunking,
- improve retrieval/reranking,
- improve prompt construction,
- preserve citations.

Do not:
- hide provenance just to make answers look cleaner.

### 20.4 “Store more metadata”
Do:
- keep metadata structured and queryable,
- prefer JSONB for flexible document/chunk/chat metadata when appropriate.

Do not:
- bury critical fields in opaque strings.

---

## 21. Definition of done for agent-made changes

A change is considered complete only when:

1. It respects the Redis vs PostgreSQL chat-history split.
2. It does not break auth.
3. It does not break upload → chunk → embed → retrieve → answer.
4. It preserves or improves citations.
5. It updates any affected config/env/docs.
6. It avoids logging secrets or raw sensitive content.
7. It remains understandable to the next engineer or coding agent.

---

## 22. Non-goals / things not to assume

Agents must **not** assume:

- Redis is the permanent chat database.
- The frontend is allowed to invent business logic independently.
- One provider will always be used.
- One model name will always be valid.
- Embedding dimension is universal across providers.
- Removing citations is acceptable.
- Audit logs are optional.

---

## 23. Practical guidance for Codex

When Codex works in this repo, it should:

- read `README.md`, `.env.example`, `docker-compose.yml`, and current backend/frontend entrypoints first,
- inspect service boundaries before editing route files,
- check whether chat-history code touches Redis, PostgreSQL, or both,
- preserve API contracts unless intentionally versioning them,
- prefer incremental refactors over broad rewrites,
- produce code that is explicit, typed, and easy to trace.

If uncertainty exists, prefer the following interpretation:

- **Redis = short-term conversation memory for frontend UX, 3-day TTL**
- **PostgreSQL = permanent audit/log store for chat history**

That is a core architectural rule of this repository.

---

## 24. Short implementation checklist

Before submitting any change, verify:

- [ ] Auth still works.
- [ ] Upload still works.
- [ ] Retrieval still works.
- [ ] Citations still exist.
- [ ] Redis temporary history still expires after 3 days.
- [ ] PostgreSQL permanent log still records chat history.
- [ ] Frontend can still read recent state correctly.
- [ ] `.env.example` / docs updated if config changed.
- [ ] No secrets are logged.

---

## 25. Summary in one paragraph

AutoLLM is a production-oriented, full-stack RAG chatbot platform where FastAPI handles ingestion, retrieval, auth, and provider orchestration; Next.js provides the user-facing app; PostgreSQL + pgvector persist documents, chunks, embeddings, users, and permanent chat audit logs; Redis stores short-lived chat session memory for frontend consumption with a strict 3-day TTL; and every meaningful code change must preserve provenance, auth boundaries, provider modularity, and the separation between ephemeral session memory and durable audit history.

