PROJECT_NAME := autollm
COMPOSE := docker compose

export COMPOSE_PROJECT_NAME := $(PROJECT_NAME)

.PHONY: up down logs ps rebuild restart backend-shell frontend-shell clean

up: .env
	$(COMPOSE) up -d --build

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

