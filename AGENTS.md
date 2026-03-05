# AGENTS.md — No‑Code RAG Chatbot (FastAPI + Next.js)

This document guides agents/builders working in this repo. Follow these rules for structure, style, and conventions. Scope: entire repository.

## Goals
- Provide a no‑code chatbot that manages a Retrieval‑Augmented Generation (RAG) pipeline end‑to‑end.
- Enable non‑technical users to upload data sources, configure chunking/retrieval, and chat with provenance (追本朔源) for every answer.
- Backend: FastAPI (Python). Frontend: Next.js (TypeScript, App Router). Model provider: OpenAI.

## Architecture Overview
- Backend (`backend/`):
  - API: FastAPI under `/api/v1/*`.
  - Ingestion: file upload -> parse -> chunk -> embed (OpenAI) -> store.
  - Vector store: SQLite for metadata + binary embedding blobs; cosine similarity in Python (numpy). No external DB required.
  - RAG: top-k retrieval -> grounding context -> OpenAI chat completion.
  - Provenance: every answer returns citations with document, chunk id, and snippet.
  - Config: persisted JSON for workspace settings (chunk size/overlap, top_k, model names).
  - Auth: PostgreSQL-backed user store (`users` table, auto-created) with bcrypt hashes + JWT issuance; every router except `/auth/*` depends on `get_current_user`.
- Frontend (`frontend/`):
  - Pages: Dashboard, Data (upload/list/delete), Settings (RAG params), Chat (converse with citations).
  - Uses `NEXT_PUBLIC_API_BASE_URL` to call backend with JWT stored in localStorage + cookie; middleware enforces redirects for unauthenticated visitors.

## Directory Layout
```
backend/
  app/
    main.py
    config.py
    models/
      chat.py
      docs.py
      common.py
      auth.py
    routes/
      auth.py
      chat.py
      docs.py
      config.py
      providers.py
    services/
      rag.py
      embeddings.py
      auth.py
      users.py
    dependencies/
      auth.py
    storage/
      vector_store.py
      user_store.py
  data/            # created at runtime (docs/, rag.sqlite, config.json)
  requirements.txt

frontend/
  app/
    layout.tsx
    page.tsx
    chat/page.tsx
    data/page.tsx
    settings/page.tsx
    login/page.tsx
    register/page.tsx
  lib/api.ts
  lib/session.ts
  middleware.ts
  next.config.js
  package.json
  tsconfig.json
```

## API Contracts (v1)
- `POST /api/v1/auth/register`: create account (requires `email`, `password`, optional `name`)
- `POST /api/v1/auth/login`: returns `{ access_token, token_type, user }`
- `GET /api/v1/auth/me`: current profile (requires JWT)
- `POST /api/v1/auth/logout`: stateless acknowledgement
- `POST /api/v1/docs/upload` (multipart): {file}
  - Response: { document_id, name }
- `GET /api/v1/docs`: list documents
- `DELETE /api/v1/docs/{document_id}`: delete doc and its chunks/embeddings
- `GET /api/v1/config`: current config
- `PUT /api/v1/config`: update config { chunk_size, chunk_overlap, top_k, chat_model, embedding_model }
- `POST /api/v1/chat`:
  - Request: { messages: [{role, content}], top_k?, temperature? }
  - Response: { answer, citations: [{document_id, name, chunk_id, score, snippet}], used_prompt }

## RAG Defaults
- chunk_size: 1000 characters
- chunk_overlap: 200 characters
- top_k: 4
- chat_model: gpt-4o-mini
- embedding_model: text-embedding-3-small

## Provenance (追本朔源)
- Return `citations` with each answer including:
  - `document_id`, `name`, `chunk_id`, `score` (similarity), `snippet` (first ~200 chars of chunk)
- Keep chunk metadata (e.g., page, filename) when available.

## Coding Conventions
- Python: type hints, Pydantic models for request/response, module‑level functions in services, keep business logic out of route handlers.
- TS/React: functional components, hooks only in components, `lib/api.ts` for fetch wrappers, no external UI framework required.
- Error handling: return `422` for invalid input, `500` with safe message for unhandled errors. Log details server‑side.
- Naming: snake_case in Python; camelCase in TS; file names kebab or lowerCamel as per framework conventions.

## Environment Variables
- Backend:
  - `OPENAI_API_KEY` (required)
  - `OPENAI_CHAT_MODEL` (default: gpt-4o-mini)
  - `OPENAI_EMBEDDING_MODEL` (default: text-embedding-3-small)
  - `DB_PATH` (default: backend/data/rag.sqlite)
  - `DATA_DIR` (default: backend/data)
  - `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `POSTGRES_HOST` (Docker Compose Postgres service uses host `postgres`; backend auto-uses port 5432 when host is `postgres`)
  - `JWT_SECRET_KEY`, `JWT_ALGORITHM`, `JWT_EXPIRES_MINUTES` (JWT issuance for auth)
- Frontend:
  - `NEXT_PUBLIC_API_BASE_URL` (e.g., http://localhost:8000)

## Run Locally
- Docker + Make (recommended):
  - Copy `.env.example` to `.env` and set `OPENAI_API_KEY`.
  - `make up` to build and start both services (`frontend:3000`, `backend:8000`).
  - `make logs` to tail logs, `make down` to stop, `make clean` to remove volumes.
- Dev without Docker:
  - Backend: `uvicorn app.main:app --reload --port 8000` from `backend/`.
  - Frontend: `npm install && npm run dev` from `frontend/`.

## Extensibility
- Vector store can be swapped by implementing the same interface as `VectorStore`.
- Add new connectors by extending ingestion parser to support more file types.
- Optional: streaming responses via SSE; keep response shape consistent if added.

## Security & Privacy
- Never log raw document content or API keys.
- Enforce CORS to expected origins in production.
- Validate file size/type on upload (basic checks included; expand as needed).
- Require valid JWT (`Authorization: Bearer <token>`) for every API call except `/api/v1/auth/*`; the frontend middleware redirects unauthenticated users to `/login`.

## Definition of Done
- Uploads index successfully; chat returns grounded answers with citations.
- Config updates persist and affect subsequent ingestions/queries.
- Clear README in code comments and this AGENTS.md provide how‑to run.
