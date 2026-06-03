# ─────────────────────────────────────────────
#  Nexus Makefile — developer productivity
# ─────────────────────────────────────────────

.PHONY: dev staging prod down logs shell migrate migrate-create lint test

## Start DEV environment (hot reload)
dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

## Start STAGING environment
staging:
	docker compose -f docker-compose.yml -f docker-compose.staging.yml up --build

## Start PRODUCTION environment (detached)
prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

## Stop all containers
down:
	docker compose down

## Stop and remove volumes (DANGER: deletes data)
down-v:
	docker compose down -v

## Follow API logs
logs:
	docker compose logs -f api

## Open shell in API container
shell:
	docker compose exec api bash

## Run Alembic migrations
migrate:
	docker compose exec api alembic upgrade head

## Create a new migration (usage: make migrate-create MSG="add users table")
migrate-create:
	docker compose exec api alembic revision --autogenerate -m "$(MSG)"

## Run linter
lint:
	docker compose exec api ruff check app/

## Run tests
test:
	docker compose exec api pytest app/tests/ -v

## Build only (no start)
build:
	docker compose build

## Show running containers
ps:
	docker compose ps
