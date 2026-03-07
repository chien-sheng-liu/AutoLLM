# No‑Code RAG Chatbot (FastAPI + Next.js)

A clear, production‑ready Retrieval‑Augmented Generation (RAG) chatbot. Upload files, configure retrieval, and chat with citations — no code required.

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Quick Start (Docker + Make)](#quick-start-docker--make)
- [Development Setup](#development-setup)
- [Configuration (Env Vars)](#configuration-env-vars)
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

## Features
- End‑to‑end ingestion: upload → parse → chunk → embed → store
- Retrieval + grounded chat with per‑answer citations
- Tunables: chunk_size, chunk_overlap, top_k, chat/embedding models, providers
- Provider health check (API key presence and basic reachability)
- JWT auth + user store in PostgreSQL

## Architecture
Front end (Next.js) → API (FastAPI) → PostgreSQL + pgvector

- Documents: original files
- Chunks: chunked text + metadata (JSONB)
- Embeddings: pgvector, searched via cosine distance using `<=>`

## Quick Start (Docker + Make)
1) Configure environment
- Copy `.env.example` to `.env`
- Set at least one provider key (e.g., `OPENAI_API_KEY`)

2) Start services
- `make up` (frontend:3000, backend:8000, postgres)
- `make logs` (tail logs)
- `make down` / `make clean` (stop / remove volumes)

3) Use the app
- Visit `http://localhost:3000/login` to register/log in
- Upload on Data page → Chat page to ask questions → Settings to tune RAG

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

Frontend
- `NEXT_PUBLIC_API_BASE_URL` (e.g., http://localhost:8000)

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

## UI Overview
- Home: minimal, commercial hero with three primary CTAs (Chat / Data / Settings)
- Data: drag‑and‑drop, multi‑file progress, name/ID filter, copy ID, batch delete (DB + index)
- Chat: streaming answers, citations foldout, model suggestions
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

## License
MIT (adjust as needed)
