-- =============================================================================
-- AutoLLM Database Initialization Script
-- Runs automatically on first PostgreSQL container startup.
-- Tables are created in dependency order to satisfy all foreign key constraints.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- Sequences
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS conversation_series_seq;

-- ---------------------------------------------------------------------------
-- Core tables (no foreign key dependencies)
-- ---------------------------------------------------------------------------

-- Documents (used by VectorStore; also referenced by user_doc_perms)
CREATE TABLE IF NOT EXISTS documents (
    id          UUID        PRIMARY KEY,
    name        TEXT        NOT NULL,
    source      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users (used by UserStore)
CREATE TABLE IF NOT EXISTS users (
    id              UUID        PRIMARY KEY,
    email           TEXT        UNIQUE NOT NULL,
    name            TEXT,
    hashed_password TEXT        NOT NULL,
    auth            TEXT        NOT NULL DEFAULT 'user',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat messages (no FK to users table by design; user_id stored as UUID)
CREATE TABLE IF NOT EXISTS chat_messages (
    id          UUID        PRIMARY KEY,
    user_id     UUID        NOT NULL,
    question    TEXT        NOT NULL,
    answer      TEXT        NOT NULL,
    citations   JSONB,
    used_prompt TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id          UUID        PRIMARY KEY,
    user_id     UUID        NOT NULL,
    title       TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    series      BIGINT      UNIQUE DEFAULT nextval('conversation_series_seq')
);

-- ---------------------------------------------------------------------------
-- Tables with foreign key dependencies
-- ---------------------------------------------------------------------------

-- Chunks → documents
CREATE TABLE IF NOT EXISTS chunks (
    id          UUID        PRIMARY KEY,
    document_id UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    cindex      INTEGER     NOT NULL,
    text        TEXT        NOT NULL,
    metadata    JSONB
);

-- Embeddings → chunks
CREATE TABLE IF NOT EXISTS embeddings (
    chunk_id    UUID        PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
    embedding   vector
);

-- User ↔ Document permissions → users, documents
CREATE TABLE IF NOT EXISTS user_doc_perms (
    user_id     UUID        NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
    document_id UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, document_id)
);

-- Feedback → chat_messages
CREATE TABLE IF NOT EXISTS feedback (
    id          UUID        PRIMARY KEY,
    user_id     UUID        NOT NULL,
    answer_id   UUID        NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    vote        SMALLINT    NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversation messages → conversations
CREATE TABLE IF NOT EXISTS conversation_messages (
    id              UUID        PRIMARY KEY,
    conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL,
    role            TEXT        NOT NULL,
    content         TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_chunks_doc          ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user  ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user       ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user  ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_series ON conversations(series);
CREATE INDEX IF NOT EXISTS idx_messages_conv       ON conversation_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_user       ON conversation_messages(user_id);

-- ---------------------------------------------------------------------------
-- Default admin account  (email: admin@admin.com / password: admin123)
-- ON CONFLICT DO NOTHING makes this idempotent — safe to re-run.
-- ---------------------------------------------------------------------------
INSERT INTO users (id, email, name, hashed_password, auth)
VALUES (
    'ebb6a252-aca6-4703-98d9-85ec013de324',
    'admin@admin.com',
    'Admin',
    '$bcrypt-sha256$v=2,t=2b,r=12$hFnym3Dw9o36dZxw6yCzdO$OeYs7Zm42pgQg8MLHfIezmOssUuRVt6',
    'admin'
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE conversations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = current_schema()
          AND tablename  = 'conversations'
          AND policyname = 'conversations_owner'
    ) THEN
        EXECUTE 'CREATE POLICY conversations_owner ON conversations
                 USING (user_id = current_setting(''app.user_id'', true)::uuid)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = current_schema()
          AND tablename  = 'conversation_messages'
          AND policyname = 'conversation_messages_owner'
    ) THEN
        EXECUTE 'CREATE POLICY conversation_messages_owner ON conversation_messages
                 USING (user_id = current_setting(''app.user_id'', true)::uuid)';
    END IF;
END$policy$;
