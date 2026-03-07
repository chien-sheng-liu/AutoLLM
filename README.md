No‑Code RAG Chatbot (FastAPI + Next.js)

A no‑code Retrieval‑Augmented Generation (RAG) chatbot. Non‑technical users can upload data sources, configure chunking/retrieval, and chat with provenance for every answer.

- Backend: FastAPI (Python)
- Frontend: Next.js (TypeScript, App Router)
- Model Providers: OpenAI, Gemini (Google), Claude (Anthropic) via a pluggable provider layer
- Vector store: PostgreSQL + pgvector（metadata + embeddings 都儲存在資料庫）

Features
- Upload txt/pdf → parse → chunk → embed → store (PostgreSQL/pgvector)
- Top‑K retrieval + grounding context → chat completion
- Provenance: citations per answer (doc, chunk id, score, snippet)
- Configurable chunk_size, chunk_overlap, top_k, chat model/provider
- Health check for providers (API keys and basic reachability)
- Polished UI (Tailwind + small UI kit) and responsive layouts
- JWT 驗證：註冊 / 登入 / 登出，所有 API 與頁面皆需登入後才能使用
- 使用 PostgreSQL 儲存使用者帳號（Docker Compose 已內建資料庫服務）

Directory
backend/
  app/
    main.py
    config.py
    models/
    routes/
    services/
    storage/
  data/            # created at runtime (docs/, config.json)
  requirements.txt

frontend/
  app/
  lib/
  package.json
  tailwind.config.js

- Storage layout：
  - `documents`：原始檔案的基本資訊（名稱、來源、建立時間）。
  - `chunks`：切分後的文字與對應 metadata（JSONB），全數存於 PostgreSQL。
  - `embeddings`：使用 pgvector 的 `vector` 欄位保存每個 chunk 的向量，並透過 `<=>` 進行 cosine 距離搜尋。

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
- EMBEDDING_DIM=1536（pgvector 欄位長度；若使用不同嵌入模型請調整）
- RAG_CHUNK_SIZE=1000, RAG_CHUNK_OVERLAP=200, RAG_TOP_K=4
- DATA_DIR=backend/data（原始檔案會保存於此）
- POSTGRES_USER=autollm, POSTGRES_PASSWORD=postgres, POSTGRES_DB=autollm, POSTGRES_PORT=5050
- POSTGRES_HOST=postgres （Docker 內部服務名稱；若本機直跑請改成 localhost）
- 後端容器偵測到 `POSTGRES_HOST=postgres` 時會自動改用資料庫內部埠號 5432 連線（主機 5050 僅供外部連線用）
- JWT_SECRET_KEY=change-me, JWT_ALGORITHM=HS256, JWT_EXPIRES_MINUTES=60

Frontend:
- NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

Run (Docker + Make)
cp .env.example .env
make up           # build + start (frontend:3000, backend:8000, postgres:5050)
make logs         # tail logs
make down         # stop
make clean        # remove volumes

PostgreSQL（內建 pgvector 擴充套件）會跟著 Docker 一起啟動（user `autollm`、password `postgres`、database `autollm`、host `postgres`）。容器啟動後會自動執行 `CREATE EXTENSION IF NOT EXISTS vector`，若你採自行安裝的 PostgreSQL 請記得手動安裝 pgvector 並建立 extension。
前端啟動後請先造訪 `http://localhost:3000/login` 註冊／登入，取得 JWT 後才能使用其餘頁面與 API。

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
- Auth endpoints (JWT): `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `POST /api/v1/auth/logout`

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
