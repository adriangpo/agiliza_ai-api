# Phase 1: Foundation - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers the project skeleton that every subsequent phase builds on: AdonisJS v7 scaffold (Node.js 24) with feature-based folder structure, PostgreSQL + PostGIS with two DB roles and FORCE ROW LEVEL SECURITY, `@adonisjs/queue` (Redis-backed via `@boringnode/queue`) ready for async jobs, ESLint v10 + Prettier + Lefthook enforcing zero-warnings zero-errors, Japa test harness with per-test transaction rollback and injectable tenant context, Docker Compose + Makefile for local dev, and a GitHub Actions CI pipeline.

No feature code ships in this phase. The output is infrastructure only.

</domain>

<decisions>
## Implementation Decisions

### Feature Folder Structure

- **D-01:** Feature code lives under `app/features/{name}/` — each feature folder contains: `controllers/`, `services/`, `validators/`, `policies/`, `routes.ts`, `tests/`, and is self-contained.
- **D-02:** Shared framework-level code lives in `app/shared/` — only base middleware, generic validators, DB provider setup, HTTP exceptions, and response helpers. Business logic never goes in shared/. If code is only used by one feature, it belongs in that feature. If it's used by 2+ features and is framework-level (not domain logic), it goes in shared/.
- **D-03:** Feature-specific tests live inside the feature folder at `app/features/{name}/tests/`. Japa config discovers them via glob: `app/features/**/*.spec.ts`.
- **D-04:** Cross-cutting tests (RLS contract tests, multi-feature integration tests) live in top-level `tests/` folder — `tests/rls/`, `tests/integration/`.
- **D-05:** Database migrations live in `database/migrations/` (AdonisJS default, central location). Filenames are prefixed by feature: `001_foundation_tenants.ts`, `002_auth_users.ts`, etc.
- **D-06:** Per-feature API documentation lives in `docs/features/{name}/API.md` and `docs/features/{name}/MODELS.md`. A shared template at `docs/templates/` defines the required structure. Docs are updated in the same commit as their code changes.
- **D-30:** All feature documentation files (`API.md`, `MODELS.md`) and any other relevant technical docs (architecture, data flow) MUST include Mermaid diagrams where they add clarity: data models as ER diagrams, request flows as sequence diagrams, state machines as state diagrams. Diagrams live inline in the markdown using fenced ` ```mermaid ``` ` blocks. The `docs/templates/` template must include example Mermaid diagram skeletons for each doc type.

### Database & RLS Setup

- **D-07:** Two PostgreSQL roles: `migrator` (DDL + RLS policy owner, used only for `node ace migration:run`) and `app` (DML only, used by the running application). No superuser credentials in `.env` for the app role.
- **D-08:** `FORCE ROW LEVEL SECURITY` applied to all tenant-scoped tables — enforces RLS even on the `migrator` role.
- **D-09:** `tenants` table uses UUID v7 as primary key. All other tables use `bigint` serial IDs. All tenant FK columns are `uuid` type.
- **D-10:** `TenantMiddleware` calls `set_config('app.tenant_id', tenantId, true)` (local=true = transaction-scoped) inside `db.transaction()`. Session-scoped `SET` is forbidden — would leak across pooled connections.
- **D-10a:** Authentication uses AdonisJS v7 `@adonisjs/auth` v10 opaque access tokens guard (DB-backed, instantly revocable). The JWT guard no longer exists in v7. Tenant context is loaded from the authenticated user's DB record, not from a token payload claim.
- **D-11:** RLS policy pattern: `USING (tenant_id = current_setting('app.tenant_id', true)::uuid)`. The second argument `true` returns NULL instead of raising an error when the setting is not set (safe outside transactions). A dedicated `tests/rls/` suite verifies that tenant A cannot read tenant B's rows even with a direct DB connection.

### CI/CD

- **D-12:** GitHub Actions. CI runs on every push and pull request to `main`.
- **D-13:** CI jobs (in order):
  1. `lint` — ESLint zero-warnings + zero-errors + tsc --noEmit
  2. `test` — Full Japa suite against a real PostgreSQL (PostGIS) + Redis (Docker services in the workflow)
  3. `build` — `node ace build`
  4. `security` — `npm audit --audit-level=high`
- **D-14:** If any job fails, the pipeline is red and merges are blocked.

### Local Dev Environment

- **D-15:** Docker Compose provides PostgreSQL (with PostGIS extension) and Redis. A `docker-compose.yml` at project root is the single source of truth for service configuration.
- **D-16:** A `Makefile` at project root exposes all developer commands. **All agents (Claude, CI scripts, docs) must use `make` targets — never raw commands.** If a make target fails, fix the target; do not bypass it with the raw command.
- **D-17:** Makefile commands to implement:
  - `make up` — `docker compose up -d`
  - `make down` — `docker compose down`
  - `make test` — run full Japa suite (NODE_ENV=test)
  - `make test-watch` — Japa watch mode (hyphens required — Makefile targets cannot contain colons)
  - `make lint` — ESLint check
  - `make lint-fix` — ESLint auto-fix
  - `make migrate` — `node ace migration:run`
  - `make migrate-fresh` — `node ace migration:fresh --seed` (hyphens required — Makefile targets cannot contain colons)
  - `make dev` — `node ace serve --watch` (added at Claude's discretion)
  - `make build` — `node ace build` (added at Claude's discretion)
  - `make typecheck` — `tsc --noEmit` (added at Claude's discretion)
- **D-18:** Separate test database: `NODE_ENV=test` points to a different DB name (e.g., `agiliza_ai_test`). Japa wraps each test in a transaction that rolls back after the test. The test DB is created via `make migrate` when `NODE_ENV=test`.

### Pre-commit Hooks

- **D-19:** **Lefthook** as the git hook manager (fast binary, no Node.js runtime dependency for hooks).
- **D-20:** `pre-commit` hook runs: ESLint on staged files (zero-warnings, zero-errors) + Prettier --write on staged files + tsc --noEmit.
- **D-21:** `commit-msg` hook enforces Conventional Commits format (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `perf:`, `ci:`).
- **D-22:** **ESLint zero-warnings policy** — warnings are treated as errors (`--max-warnings 0` flag). When a rule produces a false positive that cannot be properly fixed, suppress it with a file-scoped or line-scoped disable comment (`// eslint-disable-next-line rule-name` or `/* eslint-disable rule-name */` at file top). Project-wide rule disables in `eslint.config.js` are forbidden for anything other than test-specific rules (e.g., relaxing `@typescript-eslint/no-explicit-any` only in `*.spec.ts` files).

### Security Foundations

- **D-23:** **HTTP security headers** — strict from day one using an AdonisJS middleware (equivalent to Helmet): HSTS, Content-Security-Policy (restrictive default), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. Per-route overrides only when explicitly required.
- **D-24:** **CORS** — whitelist-only via `CORS_ALLOWED_ORIGINS` in `.env`. Empty/unset means deny all cross-origin requests. Never default to `*`.
- **D-25:** **Input character limits** — enforced at two layers simultaneously: (1) VineJS validator rejects oversized input before it touches the DB; (2) DB column has a matching `VARCHAR(N)` or `CHECK (char_length(col) <= N)` constraint as a safety net. Both layers must always be in sync. Every field stored in the DB must have an explicit character limit.
- **D-26:** **XSS — reject on write** — VineJS validator rejects any input containing HTML tags or script content outright. No sanitization pass — just rejection with a clear error message. Users cannot submit any markup.
- **D-27:** **Image upload validation** — server-side checks on every upload: (1) MIME type verified against actual magic bytes (reject spoofed extensions); (2) file extension whitelist: `.jpg`, `.jpeg`, `.png`, `.webp` only; (3) if the image exceeds 12MB or 1920×1080 — **compress and resize server-side** rather than rejecting. The client should compress, but the API handles it gracefully if it doesn't.
- **D-28:** **Storage** — Cloudflare R2 will be the production storage backend. Design the storage adapter interface with R2's S3-compatible API in mind from Phase 1, even though the real R2 adapter is wired in a later phase. Phase 1 uses a local/mock adapter.
- **D-29:** **Rate limiting middleware** — a reusable `RateLimit` middleware lives in `app/shared/middleware/`. Backed by Redis. Phase 1 sets up the infrastructure; each feature route declares its own limits. No hardcoded global limit.

### Claude's Discretion

- Specific ESLint rule set (TypeScript strict, import order, unicorn subset, etc.) — choose a well-regarded strict preset
- Prettier configuration details (print width, semicolons, single quotes, trailing commas)
- `japa.config.ts` exact setup (plugins, reporters, file globs)
- Queue provider: use `@adonisjs/queue` v0.6.0 (confirmed stable for AdonisJS v7, backed by `@boringnode/queue`). No custom BullMQ provider needed.
- `.env.example` contents and validation (use `@adonisjs/env` with strict schema)
- GitHub Actions workflow file details (Node version, caching strategy, postgres service container config)
- PostGIS extension migration (create extension in a dedicated `000_extensions.ts` migration)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements
- `.planning/REQUIREMENTS.md` — All INFRA-01 through INFRA-09 requirements, including INFRA-05b (UUID v7 for tenants)
- `.planning/PROJECT.md` — Key Decisions table (RLS approach, FORCE ROW LEVEL SECURITY, UUID v7 decision, feature-based structure)
- `.planning/ROADMAP.md` — Phase 1 success criteria (5 observable outcomes that define "done")

### Research
- `.planning/research/STACK.md` — Technology choices and rationale (⚠ written for v6, superseded — see 01-RESEARCH.md for v7-verified stack)
- `.planning/research/PITFALLS.md` — RLS + connection pool pitfall (C-1), two DB roles requirement (C-2), PgBouncer transaction mode warning (⚠ v6-era; RLS/DB patterns still valid, framework-specific parts may differ)
- `.planning/research/ARCHITECTURE.md` — Feature-based folder tree example, RLS wiring diagram, SET LOCAL transaction pattern

### External (verify before using)
- AdonisJS v7 docs — https://docs.adonisjs.com (auth v10 uses opaque access tokens; `@adonisjs/queue` v0.6.0 confirmed stable for v7)
- PostGIS docs — https://postgis.net/docs/ST_DWithin.html (geography type distance queries)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project. No existing code.

### Established Patterns
- None yet — this phase establishes the patterns all future phases follow.

### Integration Points
- This phase creates the foundation all other features integrate with: DB connection, tenant middleware, auth scaffold, test helpers, @adonisjs/queue provider.

</code_context>

<specifics>
## Specific Ideas

- Makefile is a first-class citizen: all agents must use `make` targets. Never run raw commands if a make target exists for it. If a target is broken, fix the Makefile.
- ESLint warnings are errors: `--max-warnings 0` always. No exceptions without a file-scoped or line-scoped comment with the rule name.
- Feature naming convention for migrations: `{NNN}_{feature}_{description}.ts` (e.g., `001_foundation_tenants.ts`)
- Queue: use `@adonisjs/queue` v0.6.0 with Redis adapter. Confirmed stable for v7. Use Sync adapter in test environment to avoid Redis dependency in unit tests.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-23*
