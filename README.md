No‑Code RAG Chatbot (FastAPI + Next.js)

A no‑code Retrieval‑Augmented Generation (RAG) chatbot. Non‑technical users can upload data sources, configure chunking/retrieval, and chat with provenance for every answer.

- Backend: FastAPI (Python)
- Frontend: Next.js (TypeScript, App Router)
- Model Providers: OpenAI, Gemini (Google), Claude (Anthropic) via a pluggable provider layer
- Vector store: SQLite (metadata + embedding blobs), cosine similarity with NumPy

Features
- Upload txt/pdf → parse → chunk → embed → store (SQLite)
- Top‑K retrieval + grounding context → chat completion
- Provenance: citations per answer (doc, chunk id, score, snippet)
- Configurable chunk_size, chunk_overlap, top_k, chat model/provider
- Health check for providers (API keys and basic reachability)
- Polished UI (Tailwind + small UI kit) and responsive layouts

Directory
backend/
  app/
    main.py
    config.py
    models/
    routes/
    services/
    storage/
  data/            # created at runtime (docs/, rag.sqlite, config.json)
  requirements.txt

frontend/
  app/
  lib/
  package.json
  tailwind.config.js

Environment
Copy `.env.example` to `.env` and fill values (secrets are git‑ignored).

Important variables (backend):
- OPENAI_API_KEY (for provider=openai)
- GOOGLE_API_KEY or GEMINI_API_KEY (for provider=gemini)
- ANTHROPIC_API_KEY (for provider=anthropic)
- CHAT_PROVIDER=openai | gemini | anthropic (default: openai)
- EMBEDDING_PROVIDER=openai | gemini (default: openai)
- OPENAI_CHAT_MODEL=gpt-4o-mini (default)
- OPENAI_EMBEDDING_MODEL=text-embedding-3-small (default)
- RAG_CHUNK_SIZE=1000, RAG_CHUNK_OVERLAP=200, RAG_TOP_K=4
- DATA_DIR=backend/data, DB_PATH=backend/data/rag.sqlite

Frontend:
- NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

Run (Docker + Make)
cp .env.example .env
make up           # build + start (frontend:3000, backend:8000)
make logs         # tail logs
make down         # stop
make clean        # remove volumes

Run (Dev)
Backend:
cd backend
pip install -r requirements.txt
export OPENAI_API_KEY=...  # or relevant provider key(s)
uvicorn app.main:app --reload --port 8000

Frontend:
cd frontend
npm install
export NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
npm run dev

Provider Layer
You can switch providers without code changes via the config or `.env`.
- Factory: `backend/app/services/providers/factory.py`
- Implementations:
  - OpenAI: chat + embeddings
  - Gemini: chat + embeddings (REST)
  - Claude: chat (fallback to OpenAI/Gemini embeddings if needed)

Health check:
- `GET /api/v1/providers/health` → `{ chat: {ok, provider}, embedding: {ok, provider} }`

API (v1)
- `POST /api/v1/docs/upload` (multipart): {file}
- `GET /api/v1/docs`: list documents
- `DELETE /api/v1/docs/{document_id}`
- `GET /api/v1/config` / `PUT /api/v1/config`
- `POST /api/v1/chat` and `POST /api/v1/chat/stream`
  - request: `{ messages, top_k?, temperature?, chat_model? }`
  - response: `{ answer, citations, used_prompt }` (stream emits delta/done events)

UI Notes
- Home: stats + recent documents
- Data: drag‑and‑drop uploader (multi‑file), progress, search, batch delete
- Chat: large fixed window, model override field, full‑screen mode, typing indicator, citations foldout
- Settings: provider & model suggestions, health check, RAG params

Security
- Do not commit secrets (.env is git‑ignored)
- Never log raw document contents or API keys
- Restrict CORS in production (currently permissive for development)

Troubleshooting
- OpenAI proxies error → ensure httpx is pinned: we use `httpx==0.27.2` in `backend/requirements.txt`
- Provider health: `GET /api/v1/providers/health`
- Ensure provider API keys are set for the selected provider

License
MIT (or your preferred license)

