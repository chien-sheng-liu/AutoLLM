# Unused Code Report

Scope: repository‑wide, conservative scan using textual reference checks (ripgrep) for imports/usages.

Summary
- Removed: `frontend/app/components/ui/Badge.tsx` (no references).
- Kept: All backend routes/services/storage/providers and frontend components are referenced.

Method
- For each top‑level module and UI component, scanned for import/usage patterns across the repo.
- Cross‑checked backend routers are included via `app.include_router(...)`.
- Verified providers/storage/services are referenced by routes or other services.

Findings (high level)
- Backend
  - routes: auth, chat, docs, admin, config, providers, feedback, bootstrap — all included/used.
  - services: embeddings, rag, rate_limit, users — referenced by routes; providers submodules in use via factory.
  - storage: chat_store, conv_pg_store, conversation_store, user_store, vector_store, vector_redis_store — referenced.
  - models/dependencies: referenced by routes.
- Frontend
  - Components: Card, Input, Button, Modal, Tooltip, Segmented, Stat, Textarea, Nav, Toaster — referenced by pages.
  - Badge — unused → removed.

Next steps
- If desired, enable stricter static analysis (e.g., mypy/ruff for Python, TS strict for Next.js) to surface dead symbols.
- Add CI to fail on accidental `console.log`/debug prints or `TODO` markers.

