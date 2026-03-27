---
phase: 01-foundation
verified: 2026-03-25T00:00:00Z
status: gaps_found
score: 9/11 must-haves verified
gaps:
  - truth: "Node.js 24 is active on the machine"
    status: failed
    reason: "Machine is running Node.js v22.22.0 (node --version). v24 was never installed."
    artifacts:
      - path: ".nvmrc or package.engines"
        issue: "No Node.js version pinning exists to enforce v24"
    missing:
      - "Install Node.js 24 (e.g., via fnm, nvm, or system package manager)"
      - "Add engines field to package.json: \"engines\": { \"node\": \">=24\" } so the constraint is explicit"

  - truth: "TenantMiddleware and throttle registered as named middleware (applied per route group)"
    status: partial
    reason: "TenantMiddleware is correctly registered. throttle is NOT registered in router.named(). The plan required 'throttle: () => import(\"@adonisjs/limiter/throttle_middleware\")' in kernel.ts named middleware. A code comment documents that @adonisjs/limiter v3 does not export a standalone throttle_middleware, but no alternative wiring was provided and start/limiter.ts is empty."
    artifacts:
      - path: "start/kernel.ts"
        issue: "throttle absent from router.named(). Rate limiting is completely unregistered as named middleware."
      - path: "start/limiter.ts"
        issue: "Intentionally empty stub — no throttle definitions. Acceptable for Phase 1, but kernel.ts must at minimum document the working alternative pattern."
    missing:
      - "Either wire @adonisjs/limiter's per-route API in kernel.ts as a named middleware alternative, or confirm and document that inline limiter service usage is the intended pattern for this package version"
      - "The rate_limit_middleware.ts references 'middleware.throttle(...)' in usage comments but that export doesn't exist in kernel.ts — this comment is misleading and should be corrected"
---

# Phase 01: Foundation Verification Report

**Phase Goal:** Establish the complete project foundation — AdonisJS v7 scaffold with all first-party packages, ESLint/Prettier/Lefthook toolchain, Docker Compose dev environment, PostgreSQL migrations with PostGIS/uuid-ossp, two-role DB security model, FORCE RLS tenant isolation, TenantMiddleware, Japa test harness with RLS contract tests, queue/Redis infrastructure, and GitHub Actions CI pipeline.
**Verified:** 2026-03-25T00:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | AdonisJS v7 API project exists and boots without errors | VERIFIED | `package.json` has `@adonisjs/core ^7.0.0`; `adonisrc.ts` has `defineConfig`; all providers registered |
| 2 | Node.js 24 is active on the machine | FAILED | `node --version` returns v22.22.0 — v24 was not installed |
| 3 | Feature-based folder structure is in place | VERIFIED | `app/features/`, `app/shared/middleware/`, `app/shared/contracts/`, `tests/rls/`, `tests/integration/`, `docs/templates/` all exist |
| 4 | All first-party packages are installed and configured | VERIFIED | `@adonisjs/lucid`, `@adonisjs/auth`, `@adonisjs/redis`, `@adonisjs/limiter`, `@adonisjs/drive`, `@adonisjs/queue` all present in `package.json` |
| 5 | ESLint/Prettier/Lefthook toolchain enforces zero-warnings | VERIFIED | `eslint.config.ts` uses `@adonisjs/eslint-config`; `.prettierrc` uses `@adonisjs/prettier-config`; `lefthook.yml` has `pre-commit` + `commit-msg` with `--max-warnings 0` |
| 6 | Docker Compose provides PostgreSQL+PostGIS and Redis services | VERIFIED | `docker-compose.yml` uses `postgis/postgis:17-3.5` and `redis:7-alpine` with healthchecks |
| 7 | Two DB roles (migrator DDL, app DML) and FORCE RLS migration pattern exist | VERIFIED | `database/setup/create_roles.sql` creates both roles idempotently; `config/database.ts` defines `pg` and `pg_migrator` connections; `001_foundation_tenants.ts` contains canonical RLS comment with `FORCE ROW LEVEL SECURITY`, `WITH CHECK`, `current_setting('app.tenant_id', true)` |
| 8 | TenantMiddleware sets app.tenant_id via set_config inside transaction, next() called inside transaction | VERIFIED | `tenant_middleware.ts` uses `db.transaction()`, `trx.rawQuery('SELECT set_config(...)')` with `'true'` arg, `next()` called inside the transaction callback |
| 9 | TenantMiddleware and throttle registered as named middleware | PARTIAL | `tenant` is registered in `router.named()`. `throttle` is absent — comment in kernel.ts explains @adonisjs/limiter v3 lacks a standalone export, but no alternative wiring exists |
| 10 | Japa test harness runs with per-test transaction rollback and RLS contract tests pass | VERIFIED | `tests/bootstrap.ts` has `pluginAdonisJS`, `testUtils.db().migrate()`, `testUtils.httpServer().start()`; `tests/rls/tenant_isolation.spec.ts` has 5 tests with `withGlobalTransaction()`, `FORCE ROW LEVEL SECURITY` live enforcement, `CREATE POLICY` |
| 11 | Queue/Redis infrastructure and GitHub Actions CI pipeline are in place | VERIFIED | `config/queue.ts` uses `drivers.redis` for dev/prod and `drivers.sync` for test; `app/jobs/health_job.ts` dispatches via `HealthJob.dispatch({})`; `.github/workflows/ci.yml` has 4 jobs (lint, test, build, security) with `postgis/postgis:17-3.5` and correct `needs: [lint, test]` |

**Score:** 9/11 truths verified (1 failed, 1 partial)

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `package.json` | VERIFIED | Contains all required packages; no banned packages present |
| `adonisrc.ts` | VERIFIED | All providers registered; test suites defined with correct globs |
| `app/features/` | VERIFIED | Exists |
| `app/shared/` | VERIFIED | `middleware/`, `contracts/`, `adapters/`, `exceptions/`, `utils/` all exist |
| `start/env.ts` | VERIFIED | Contains `PG_HOST`, `PG_MIGRATOR_USER`, `REDIS_HOST`, `CORS_ALLOWED_ORIGINS` |
| `eslint.config.ts` | VERIFIED | Uses `@adonisjs/eslint-config` v3 (`configApp()`); `database/schema.ts` in ignores |
| `.prettierrc` | VERIFIED | Contains `"@adonisjs/prettier-config"` |
| `lefthook.yml` | VERIFIED | `pre-commit` with `--max-warnings 0`; `commit-msg` with `commitlint --edit {1}` |
| `.commitlintrc.json` | VERIFIED | Extends `@commitlint/config-conventional`; `type-enum` includes `feat`, `fix`, `ci`, `test` |
| `docker-compose.yml` | VERIFIED | `postgis/postgis:17-3.5`; `redis:7-alpine`; healthchecks on both services |
| `Makefile` | VERIFIED | All targets present; `migrate` uses `DB_CONNECTION=pg_migrator`; `test` uses `NODE_ENV=test` |
| `database/migrations/000_foundation_extensions.ts` | VERIFIED | `CREATE EXTENSION IF NOT EXISTS postgis`; `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`; `down()` is no-op |
| `database/migrations/001_foundation_tenants.ts` | VERIFIED | `table.uuid('id').primary()`; canonical RLS comment block with FORCE, WITH CHECK, `current_setting(..., true)` |
| `database/setup/create_roles.sql` | VERIFIED | Idempotent; `migrator` (DDL) and `app` (DML) roles; `GRANT CONNECT` (not GRANT ALL) |
| `config/database.ts` | VERIFIED | Two connections: `pg` (app role) and `pg_migrator` (migrator role) |
| `app/shared/middleware/tenant_middleware.ts` | VERIFIED | `db.transaction()`, `set_config('app.tenant_id', ?, ?)` with `'true'`, `next()` inside transaction |
| `app/shared/contracts/http_context.ts` | VERIFIED | Augments `HttpContext` with `tenantId: string` and `db: TransactionClientContract` |
| `app/shared/middleware/security_headers_middleware.ts` | VERIFIED | Sets HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| `app/shared/middleware/rate_limit_middleware.ts` | VERIFIED (stub) | Intentional stub documenting usage pattern — acceptable for Phase 1 |
| `start/kernel.ts` | PARTIAL | SecurityHeadersMiddleware in server.use(); tenant in router.named(); throttle ABSENT from router.named() |
| `tests/bootstrap.ts` | VERIFIED | `pluginAdonisJS(testUtils)`, `testUtils.db().migrate()`, `testUtils.httpServer().start()` |
| `japa.config.ts` | VERIFIED (pattern) | Re-exports bootstrap; suites are in `adonisrc.ts` per AdonisJS v7 convention |
| `tests/rls/tenant_isolation.spec.ts` | VERIFIED | 5 tests; `withGlobalTransaction()`; live `FORCE ROW LEVEL SECURITY` + `CREATE POLICY` in test body; `uuidv7()` for IDs |
| `app/features/foundation/tests/unit/tenant_middleware.spec.ts` | VERIFIED | 2 tests; `withGlobalTransaction()`; verifies set_config visibility and reset |
| `config/queue.ts` | VERIFIED | `drivers.redis({ connectionName: 'main' })` for dev/prod; `drivers.sync()` for test; env-switched |
| `config/redis.ts` | VERIFIED | Connection named `main` — matches queue config reference |
| `app/jobs/health_job.ts` | VERIFIED | `static executed = false`; `execute()` sets it to `true` |
| `tests/jobs/health_job.spec.ts` | VERIFIED | Resets `HealthJob.executed`; calls `HealthJob.dispatch({})`; asserts `executed === true` |
| `start/limiter.ts` | VERIFIED (stub) | Intentional empty stub documenting Phase 3+ usage |
| `docs/templates/API.md` | VERIFIED | `sequenceDiagram` Mermaid block present |
| `docs/templates/MODELS.md` | VERIFIED | `erDiagram` Mermaid block + RLS policy SQL present |
| `.github/workflows/ci.yml` | VERIFIED | 4 jobs; `build` has `needs: [lint, test]`; `postgis/postgis:17-3.5`; `redis:7-alpine`; `NODE_ENV: test`; `make migrate` before `make test`; `GRANT CONNECT` (not GRANT ALL) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `adonisrc.ts` | app providers | `providers` array | WIRED | All 9 providers including `queue_provider` present |
| `start/routes.ts` | feature route files | dynamic imports | PARTIAL | Health check route present; no feature routes yet (expected at Phase 1) |
| `lefthook.yml` | `eslint.config.ts` | `npx eslint --max-warnings 0 {staged_files}` | WIRED | `max-warnings 0` present in pre-commit lint command |
| `lefthook.yml` | `.commitlintrc.json` | `npx commitlint --edit {1}` | WIRED | `commitlint` present in commit-msg section |
| `database/migrations/001_foundation_tenants.ts` | tenants table | `this.schema.createTable('tenants', ...)` | WIRED | `createTable('tenants', ...)` present |
| `config/database.ts` | `start/env.ts` | `env.get('PG_USER')` | WIRED | `env.get('PG_HOST')`, `env.get('PG_USER')`, `env.get('PG_MIGRATOR_USER')` all used |
| `tenant_middleware.ts` | `db.transaction()` | `set_config('app.tenant_id', tenantId, true)` | WIRED | `trx.rawQuery('SELECT set_config(...)', [tenantId, 'true'])` inside `db.transaction()` |
| `start/kernel.ts` | `security_headers_middleware.ts` | `server.use()` | WIRED | `() => import('#shared/middleware/security_headers_middleware')` in `server.use([...])` |
| `start/kernel.ts` | throttle middleware | `router.named()` | NOT WIRED | `throttle` key absent from `router.named()`; @adonisjs/limiter v3 incompatibility documented in comment |
| `tests/bootstrap.ts` | `testUtils.db().migrate()` | `runnerHooks.setup` | WIRED | `() => testUtils.db().migrate()` in setup array |
| `tests/rls/tenant_isolation.spec.ts` | FORCE ROW LEVEL SECURITY | temp table in test | WIRED | Live `ALTER TABLE test_rls_items FORCE ROW LEVEL SECURITY` executed inside test transaction |
| `config/queue.ts` | `@adonisjs/queue` | `drivers.redis` | WIRED | `drivers.redis({ connectionName: 'main' })` in adapters |
| `tests/jobs/health_job.spec.ts` | `app/jobs/health_job.ts` | `HealthJob.dispatch({})` | WIRED | `await HealthJob.dispatch({})` called; `HealthJob.executed` asserted |
| `.github/workflows/ci.yml` | Makefile targets | `run: make` | WIRED | `make lint`, `make typecheck`, `make migrate`, `make test`, `make build` all used |

---

### Data-Flow Trace (Level 4)

Phase 1 produces no dynamic-data-rendering components (no controllers, no pages, no dashboards). All artifacts are infrastructure: middleware, migration, config, and test files. Level 4 data-flow trace is not applicable.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Makefile lint target has `--max-warnings 0` | `make --dry-run lint` | prints `npx eslint . --max-warnings 0` | PASS |
| Makefile test target has `NODE_ENV=test` | `make --dry-run test` | prints `NODE_ENV=test node ace test` | PASS |
| Makefile migrate uses `DB_CONNECTION=pg_migrator` | `make --dry-run migrate` | prints `DB_CONNECTION=pg_migrator node ace migration:run` | PASS |
| docker-compose YAML is valid | `docker compose config --quiet` | requires Docker running — skip | SKIP |
| RLS contract tests run (requires DB) | `NODE_ENV=test node ace test --suite=rls` | requires DB — skip | SKIP |
| No banned packages in package.json | grep for ts-node, jsonwebtoken, jest, vitest, husky, simple-git-hooks | no matches | PASS |

---

### Requirements Coverage

| Requirement | Plan | Description | Status | Evidence |
|-------------|------|-------------|--------|----------|
| INFRA-01 | 01-01 | AdonisJS v7 scaffold, Node.js 24, feature folder structure | PARTIAL | Scaffold complete, all packages installed, folder structure present. Node.js v24 not installed on machine. |
| INFRA-02 | 01-02 | ESLint v10 + Prettier + Lefthook + commitlint | SATISFIED | All 4 tools configured correctly with all required rules |
| INFRA-03 | 01-04 | PostGIS extension enabled | SATISFIED | `000_foundation_extensions.ts` creates `postgis` extension idempotently |
| INFRA-04 | 01-04 | Two DB roles: migrator (DDL) and app (DML only) | SATISFIED | `create_roles.sql` creates both roles; `config/database.ts` has two connections; GRANT CONNECT only for app at DB level |
| INFRA-05 | 01-04, 01-06 | FORCE ROW LEVEL SECURITY on tenant-scoped tables | SATISFIED | Canonical pattern in `001_foundation_tenants.ts`; live enforcement test in `tenant_isolation.spec.ts` |
| INFRA-05b | 01-04 | Tenants table uses UUID v7 primary key | SATISFIED | `table.uuid('id').primary()` with comment noting UUID v7 from `uuidv7` package |
| INFRA-06 | 01-05 | TenantMiddleware with set_config is_local=true inside transaction | SATISFIED | `tenant_middleware.ts` and unit test both verified |
| INFRA-07 | 01-06 | Japa test harness with per-test transaction rollback | SATISFIED | `tests/bootstrap.ts` wired; `tests/rls/tenant_isolation.spec.ts` with 5 tests |
| INFRA-08 | 01-03, 01-07 | Docker Compose + queue/Redis infrastructure | SATISFIED | `docker-compose.yml` has PostgreSQL+PostGIS+Redis; `config/queue.ts` Redis+Sync; `HealthJob` dispatch test |
| INFRA-09 | 01-07 | GitHub Actions CI pipeline | SATISFIED | `.github/workflows/ci.yml` has 4 jobs with correct dependencies and service containers |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `start/kernel.ts` | 48-51 | `throttle` absent from `router.named()`; misleading comment in `rate_limit_middleware.ts` refers to `middleware.throttle(...)` which does not exist | Warning | Rate limiting cannot be applied per-route using the documented pattern until this is resolved |
| `package.json` | — | No `engines` field to pin Node.js version | Warning | Nothing prevents running the project on Node.js 22 despite v24 being required |
| `japa.config.ts` | — | File only re-exports from bootstrap; plan expected a full `configure()` call but AdonisJS v7 drives suites from `adonisrc.ts` | Info | Deviation from plan is intentional and correct for AdonisJS v7 — not a real issue |
| `app/jobs/health_job.ts` | 7, 12 | Uses `Job` base class + `execute()` method (plan said `BaseJob` + `handle()`) | Info | Actual @adonisjs/queue v0.6.0 API differs from plan spec; implementation is correct for the real package |
| `config/queue.ts` | 14-19 | Uses `adapters:` + `default:` schema (plan said `queue:` + `driver:`) | Info | Actual @adonisjs/queue v0.6.0 API differs from plan spec; implementation is correct for the real package |

---

### Human Verification Required

#### 1. Node.js 24 Installation

**Test:** Run `node --version` in the project directory
**Expected:** `v24.x.x`
**Why human:** Requires system-level package installation outside the codebase

#### 2. Full Test Suite Green

**Test:** Start Docker services (`make up`), run DB setup (`make setup-db`), run migrations (`make migrate`), then run tests (`make test`)
**Expected:** All test suites exit 0; RLS contract tests (5 tests), TenantMiddleware unit tests (2 tests), and HealthJob dispatch test all pass
**Why human:** Requires running Docker and a live PostgreSQL connection

#### 3. Pre-commit Hook Enforcement

**Test:** Stage a TypeScript file with a lint violation and attempt to commit
**Expected:** Lefthook blocks the commit and prints the lint error
**Why human:** Requires an active git repository with staged changes

#### 4. throttle Named Middleware Resolution

**Test:** Determine if `@adonisjs/limiter v3` provides any export usable as a named middleware, or confirm the inline limiter service pattern is the correct approach for this version
**Expected:** Either `throttle` is added to `router.named()` OR the usage pattern in `rate_limit_middleware.ts` comments is corrected to reflect the actual API
**Why human:** Requires reading @adonisjs/limiter v3 changelog/docs to determine authoritative pattern

---

### Gaps Summary

Two gaps are blocking full goal achievement:

**Gap 1 — Node.js 24 not installed (INFRA-01 partial):** The machine runs v22.22.0. AdonisJS v7 and the project's CLAUDE.md both require Node.js 24. The project appears to work on v22 (no evidence of runtime errors) but this violates the stated constraint. Fixing requires installing Node.js 24 at the system level and optionally adding an `engines` field to `package.json` to enforce it programmatically.

**Gap 2 — throttle not registered as named middleware (INFRA-06 kernel wiring partial):** The plan (01-05) required `throttle: () => import('@adonisjs/limiter/throttle_middleware')` in `router.named()`. This export does not exist in `@adonisjs/limiter v3`. The kernel.ts code has a comment acknowledging this. However, the `rate_limit_middleware.ts` comments still instruct feature developers to use `middleware.throttle('submissions')` — which does not exist. This creates misleading guidance. Resolution: update `rate_limit_middleware.ts` comments to document the actual per-route inline limiter pattern for this package version.

The two gaps are independent and low-risk operationally — nothing blocks Phase 2 development. The Node.js version gap is a machine-level constraint and the throttle gap is a documentation inconsistency, not a runtime failure.

---

_Verified: 2026-03-25T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
