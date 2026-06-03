# ═══════════════════════════════════════════════════════════════════
#  KALIE — Super App de Angola — Makefile raiz
#  Uso: make up | make down | make logs | make migrate
# ═══════════════════════════════════════════════════════════════════

.PHONY: up down logs shell-api shell-db migrate migrate-create ps clean

## Sobe tudo (build + start)
up:
	docker compose up --build

## Sobe em background
up-d:
	docker compose up --build -d

## Para tudo
down:
	docker compose down

## Para e apaga volumes (CUIDADO: apaga a base de dados)
down-v:
	docker compose down -v

## Logs de todos os serviços
logs:
	docker compose logs -f

## Logs só do API
logs-api:
	docker compose logs -f api

## Logs só do frontend
logs-front:
	docker compose logs -f frontend

## Shell no container da API
shell-api:
	docker compose exec api bash

## Shell no PostgreSQL
shell-db:
	docker compose exec db psql -U kalie_user -d kalie_dev

## Correr migrações Alembic
migrate:
	docker compose exec api alembic upgrade head

## Criar nova migração (uso: make migrate-create MSG="add users table")
migrate-create:
	docker compose exec api alembic revision --autogenerate -m "$(MSG)"

## Ver containers a correr
ps:
	docker compose ps

## Limpar imagens não usadas
clean:
	docker system prune -f
