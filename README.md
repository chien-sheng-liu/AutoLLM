# No‑Code RAG Chatbot (FastAPI + Next.js)

A clear, production‑ready Retrieval‑Augmented Generation (RAG) chatbot. Upload files, configure retrieval, and chat with citations — no code required.

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Quick Start (Docker + Make)](#quick-start-docker--make)
- [Image Versioning](#image-versioning)
- [Development Setup](#development-setup)
- [Configuration (Env Vars)](#configuration-env-vars)
- [Production Guide](#production-guide)
- [API Overview](#api-overview)
- [UI Overview](#ui-overview)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Overview
- Upload .txt/.pdf and the system will parse, chunk, embed, and index your content.
- Ask questions; the app retrieves top‑K similar chunks, builds context, and generates answers with citations.
- Simple, focused UI with dark mode support.

- Backend: FastAPI (Python)
- Frontend: Next.js (TypeScript, App Router)
- Providers: OpenAI / Gemini / Claude (pluggable)
- Vector store: PostgreSQL + pgvector (metadata and embeddings in DB)
- Conversations/history: Redis (UI cache, 3‑day TTL) + Postgres (permanent audit/log)

## Features
- End‑to‑end ingestion: upload → parse → chunk → embed → store
- Retrieval + grounded chat with per‑answer citations
- Tunables: chunk_size, chunk_overlap, top_k, chat/embedding models, providers
- Provider health check (API key presence and basic reachability)
- JWT auth + user store in PostgreSQL

## Architecture
Front end (Next.js) → API (FastAPI) → Redis (UI cache) + PostgreSQL (pgvector + audit)

- Documents: original files
- Chunks: chunked text + metadata (JSONB)
- Embeddings: pgvector, searched via cosine distance using `<=>`
- Conversations & History
  - Per‑user isolation enforced server‑side (JWT)
  - Redis (UI cache): conversations index and messages, 3‑day TTL
  - Postgres (audit/log): conversations + conversation_messages (permanent)

## Quick Start (Docker + Make)
1) Configure environment
- Copy `.env.example` to `.env`
- Set at least one provider key (e.g., `OPENAI_API_KEY`)

2) Start services
- `make up` (frontend:3000, backend:8000, postgres, redis)
- `make logs` (tail logs)
- `make down` / `make clean` (stop / remove volumes)

3) Use the app
- Visit `http://localhost:3000/login` to register/log in
- Upload on Data page → Chat page to ask questions → Settings to tune RAG

## Image Versioning

Docker images are tagged automatically based on git history. No manual version string maintenance is required.

### Version format: `MAJOR.MINOR`

| Component | Source | Example |
|-----------|--------|---------|
| `MAJOR` | Latest git tag (e.g. `v2`) | `2` |
| `MINOR` | Total commit count on current branch | `47` |
| Full tag | `MAJOR.MINOR` | `autollm-backend:2.47` |

Every `make up` prints the current version and tags images accordingly:
```
▶ Building autollm 2.47…
✓ Services running as autollm:2.47
```

### Bumping the major version

When starting a new major release cycle, create a git tag:

```bash
make tag v=2        # creates git tag v2
# or equivalently:
git tag v2
```

The next `make up` will produce `autollm-backend:2.X` and `autollm-frontend:2.X`.

### Minor version (automatic)

Every commit automatically increments the minor version — no action needed.

```bash
git commit -m "feat: add something"   # MINOR +1 on next build
make up                               # → autollm:2.48
```

### Inspect current version

```bash
make version    # prints e.g. 2.47
```

### First-time setup (no tag yet)

If the repo has no git tag, the version defaults to `0.<commit-count>` (e.g. `0.12`). Create `v1` when you're ready for a named release:

```bash
make tag v=1
```

### How it works internally

The Makefile derives the version at build time:

```makefile
GIT_TAG := $(shell git describe --tags --abbrev=0 2>/dev/null || echo "v0")
MAJOR   := $(shell echo "$(GIT_TAG)" | grep -oE '[0-9]+' | head -1)
MINOR   := $(shell git rev-list --count HEAD 2>/dev/null || echo "0")
VERSION := $(MAJOR).$(MINOR)
```

`IMAGE_TAG` is exported as an environment variable and consumed by `docker-compose.yml`:

```yaml
image: autollm-backend:${IMAGE_TAG:-latest}
image: autollm-frontend:${IMAGE_TAG:-latest}
```

---

## Development Setup
Backend
- `cd backend && pip install -r requirements.txt`
- Export provider key(s) (e.g., `OPENAI_API_KEY`)
- `uvicorn app.main:app --reload --port 8000`

Frontend
- `cd frontend && npm install`
- `export NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`
- `npm run dev`

## Configuration (Env Vars)
Backend (set keys for the providers you use)
- `OPENAI_API_KEY` | `GOOGLE_API_KEY` (Gemini) | `ANTHROPIC_API_KEY`
- `OPENAI_CHAT_MODEL` (default: gpt-4o-mini)
- `OPENAI_EMBEDDING_MODEL` (default: text-embedding-3-small)
- `DATA_DIR` (default: backend/data)
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `EMBEDDING_DIM` (pgvector dimension — must match the embedding model)
- `JWT_SECRET_KEY`, `JWT_ALGORITHM`, `JWT_EXPIRES_MINUTES`

Redis (UI cache)
- `REDIS_URL` (recommended) or `REDIS_HOST`, `REDIS_PORT` (default 6379), `REDIS_DB`

Frontend
- `NEXT_PUBLIC_API_BASE_URL` (e.g., http://localhost:8000)

## Production Guide

Reverse proxy and TLS
- Terminate TLS at a proxy (Nginx/Traefik/Cloud LB), forward to `frontend:3000` and `backend:8000`.

CORS and environment
- Backend: set `BACKEND_CORS_ORIGINS` to comma‑separated origins.
- Frontend: set `NEXT_PUBLIC_API_BASE_URL` to the backend base URL.

Gunicorn (backend)
- Runs `gunicorn -k uvicorn.workers.UvicornWorker` by default.
- Tunables: `GUNICORN_WORKERS` (default 2), `GUNICORN_TIMEOUT` (default 60).

Health checks and startup order
- docker‑compose includes health checks for backend (`/healthz`), postgres (`pg_isready`), and redis (`redis-cli ping`).
- `backend` depends on healthy postgres/redis; `frontend` depends on healthy backend.

Logging and request tracing
- Request IDs: propagates/returns `X-Request-ID`; JSON payloads include `request_id`.
- Access logs: method, path, status, duration, request ID (set via `LOG_LEVEL`).

Error handling and providers
- Unified error shape: `{ ok: false, error, request_id }` or JSON detail.
- Provider errors: `{ error: "provider_error", provider, code, message }` (e.g., `unauthorized`, `rate_limited`, `timeout`).

Security notes
- Never commit secrets. Restrict CORS for production origins.
- Avoid logging raw document/chat contents.

Data retention
- Redis: 3‑day TTL for recent chat UX.
- Postgres: durable audit trail.

Quick deploy
1) Copy `.env.example` → `.env`, set keys and CORS.
2) `docker compose build --no-cache && docker compose up -d`
3) `docker compose ps` and `curl -sS http://localhost:8000/healthz`

## API Overview (v1)
Auth
- POST `/api/v1/auth/register`
- POST `/api/v1/auth/login`
- GET `/api/v1/auth/me`
- POST `/api/v1/auth/logout`

Documents
- POST `/api/v1/docs/upload` (multipart: {file}) → `{ document_id, name }`
- GET `/api/v1/docs` → list documents
- DELETE `/api/v1/docs/{document_id}` → delete document + chunks + embeddings

Config
- GET `/api/v1/config` / PUT `/api/v1/config`

Chat
- POST `/api/v1/chat` (sync)
- POST `/api/v1/chat/stream` (events: delta/done/error)

Conversations (per‑user)
- GET `/api/v1/chat/conversations` → list conversations (from Redis cache)
- POST `/api/v1/chat/conversations` → create (writes Postgres + Redis)
- PUT `/api/v1/chat/conversations/{id}` → rename
- DELETE `/api/v1/chat/conversations/{id}` → delete (purges Redis + Postgres)
- GET `/api/v1/chat/conversations/{id}` → messages (from Redis cache)
- POST `/api/v1/chat/conversations/migrate` → optional, rehydrate legacy Redis blobs into Postgres audit rows

## UI Overview
- Home: minimal, commercial hero with three primary CTAs (Chat / Data / Settings)
- Data: drag‑and‑drop, multi‑file progress, name/ID filter, copy ID, batch delete (DB + index)
- Chat: streaming answers, citations foldout, model suggestions; per‑tab login; history loaded from Redis (3‑day TTL) with Postgres as audit
- Settings: Simple/Advanced modes; provider buttons; chat model via suggestions; provider health check

## Security
- Do not log secrets or raw document contents
- Restrict CORS and secure secrets in production
- All non‑`/auth/*` endpoints require JWT; the frontend clears session and redirects to login on 401
- PDF parsing uses `pypdf`; encrypted PDFs require `cryptography`. If not decryptable, the API returns 422

## Troubleshooting
- pgvector: ensure the extension is installed (`CREATE EXTENSION IF NOT EXISTS vector`)
- Provider health: GET `/api/v1/providers/health`
- PDF upload errors: rebuild backend to install `cryptography`, or upload an unencrypted file
- Conversations not persisting: ensure Redis is up; backend writes to Redis (UI cache) and Postgres (audit)
- Deleted conversations reappear: confirm DELETE 200 and that Redis index/messages were purged

## Rate limits
- Chat: 60 requests/min per user
- Conversations: create/delete 30/min; rename 60/min per user
- Migrate: 3 requests/hour per user

## Data retention
- Redis stores a 3‑day UI history for fast UX
- Postgres stores the full audit trail (conversations + messages)

## License
MIT (adjust as needed)
