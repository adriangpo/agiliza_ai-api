# Makefile
# D-16: Makefile is law. All commands go through make targets.
# Agents (Claude, CI, docs) MUST use make targets — never raw commands.
# If a target fails, fix the Makefile; do not bypass it.
# Note: Makefile targets cannot contain colons — use hyphens instead
#   (e.g., test-watch instead of test:watch, migrate-fresh instead of migrate:fresh)

.PHONY: up down dev build test test-watch lint lint-fix typecheck audit migrate migrate-fresh setup-db

# ── Docker Services ──────────────────────────────────────────────────────────
up:
	docker compose up -d

down:
	docker compose down

# ── Development ──────────────────────────────────────────────────────────────
dev:
	node ace serve --watch

build:
	node ace build

# ── Testing ──────────────────────────────────────────────────────────────────
# D-18: NODE_ENV=test routes to the test database (agiliza_ai_test)
test:
	NODE_ENV=test node ace test

# D-17: test-watch = test:watch (colons not allowed in Makefile targets)
test-watch:
	NODE_ENV=test node ace test --watch

# ── Code Quality ─────────────────────────────────────────────────────────────
# D-22: --max-warnings 0 always. Zero tolerance for warnings.
lint:
	pnpm exec eslint . --max-warnings 0

lint-fix:
	pnpm exec eslint . --fix --max-warnings 0

typecheck:
	pnpm exec tsc --noEmit

audit:
	pnpm audit --audit-level=high

# ── Database ─────────────────────────────────────────────────────────────────
# D-07: Migrations run as 'migrator' role (DDL owner). Never run as 'app'.
migrate:
	DB_CONNECTION=pg_migrator node ace migration:run

# D-17: migrate-fresh = migrate:fresh (colons not allowed in Makefile targets)
migrate-fresh:
	DB_CONNECTION=pg_migrator node ace migration:fresh --seed

# INFRA-04: One-time DB role setup — run as superuser before first migration.
setup-db:
	docker exec -i $$(docker compose ps -q postgres) psql -U agiliza_ai -f /dev/stdin < database/setup/create_roles.sql
