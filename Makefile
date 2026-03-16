PROJECT_NAME := autollm
COMPOSE      := docker compose

# ── Image Versioning ──────────────────────────────────────────────────────────
# MAJOR  →  從最新的 git tag 取得（例如 v2 → 2）；沒有 tag 時預設為 0
# MINOR  →  目前分支的 commit 總數，每新增一個 commit 自動 +1
# 完整版本號格式：MAJOR.MINOR（例如 2.47）
#
# 升版規則：
#   大版本升級 → make tag v=<number>   （例如 make tag v=2）
#   小版本升級 → git commit              （自動累積）
GIT_TAG := $(shell git describe --tags --abbrev=0 2>/dev/null || echo "v0")
MAJOR   := $(shell echo "$(GIT_TAG)" | grep -oE '[0-9]+' | head -1)
MINOR   := $(shell git rev-list --count HEAD 2>/dev/null || echo "0")
VERSION := $(MAJOR).$(MINOR)

export COMPOSE_PROJECT_NAME := $(PROJECT_NAME)
export IMAGE_TAG             := $(VERSION)

.PHONY: up up-nocache down logs ps rebuild restart backend-shell frontend-shell clean version tag

## 顯示目前版本號
version:
	@echo "$(VERSION)"

## 建立新的 git tag 以升級大版本（用法：make tag v=2）
tag:
	@test -n "$(v)" || (echo "用法：make tag v=<數字>  例如：make tag v=2" && exit 1)
	git tag v$(v)
	@echo "已建立 tag v$(v)，下次 make up 將使用版本 $(v).$(MINOR)"

## 啟動所有服務（含 build）
up: .env
	@echo "▶ Building autollm $(VERSION)…"
	$(COMPOSE) up -d --build
	@echo "Waiting for postgres to be ready..."
	@until $(COMPOSE) exec -T postgres pg_isready -q; do sleep 2; done
	@echo "Initializing database schema..."
	@$(COMPOSE) exec -T postgres bash -c 'psql -U $$POSTGRES_USER -d $$POSTGRES_DB -f /docker-entrypoint-initdb.d/init.sql'
	@echo "✓ Database ready. Services running as autollm:$(VERSION)"

## 完整重新 build（不使用任何 cache）並啟動
up-nocache: .env
	@echo "▶ Force-rebuilding autollm $(VERSION) (no cache)…"
	$(COMPOSE) build --no-cache
	$(COMPOSE) up -d
	@echo "✓ Services running as autollm:$(VERSION)"

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

rebuild:
	@echo "▶ Rebuilding autollm $(VERSION) (no cache)…"
	$(COMPOSE) build --no-cache

restart: down up

backend-shell:
	$(COMPOSE) exec backend sh

frontend-shell:
	$(COMPOSE) exec frontend sh

clean:
	$(COMPOSE) down -v

# helper: create .env from example if missing
.env:
	@test -f .env || (echo "Creating .env from .env.example" && cp .env.example .env)
	@echo "Ensure OPENAI_API_KEY is set in .env."
