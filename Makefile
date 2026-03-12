PROJECT_NAME := autollm
COMPOSE := docker compose

export COMPOSE_PROJECT_NAME := $(PROJECT_NAME)

.PHONY: up up-nocache down logs ps rebuild restart backend-shell frontend-shell clean

up: .env
	$(COMPOSE) up -d --build
	@echo "Waiting for postgres to be ready..."
	@until $(COMPOSE) exec -T postgres pg_isready -q; do sleep 2; done
	@echo "Initializing database schema..."
	@$(COMPOSE) exec -T postgres bash -c 'psql -U $$POSTGRES_USER -d $$POSTGRES_DB -f /docker-entrypoint-initdb.d/init.sql'
	@echo "Database ready."

# Force a full rebuild without using any cache layers
up-nocache: .env
	$(COMPOSE) build --no-cache
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

rebuild:
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
