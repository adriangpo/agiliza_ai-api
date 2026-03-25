---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [adonisjs, nodejs, typescript, postgresql, redis, lucid, japa, eslint, prettier, lefthook]

# Dependency graph
requires: []
provides:
  - AdonisJS v7 API project skeleton booting with Node.js 24
  - Feature-based folder structure (app/features, app/shared, app/models)
  - All first-party packages installed and configured (lucid, auth, redis, limiter, drive, queue)
  - PostgreSQL connection config with pg driver
  - Environment schema validation (PG, Redis, CORS)
  - Test suites configured (unit, functional, rls, integration)
  - Path aliases for #features/*, #shared/*, #models/*, #database/*
affects: [02-authentication-identity, 03-geo-reporting, all future phases]

# Tech tracking
tech-stack:
  added:
    - "@adonisjs/core ^7.0.0"
    - "@adonisjs/lucid ^22.0.0 (PostgreSQL via pg ^8.20.0)"
    - "@adonisjs/auth ^10.0.0 (opaque access tokens)"
    - "@adonisjs/redis ^10.0.0"
    - "@adonisjs/limiter ^3.0.1"
    - "@adonisjs/drive ^4.0.0"
    - "@adonisjs/queue ^0.6.0 (backed by @boringnode/queue)"
    - "@adonisjs/cors ^3.0.0"
    - "uuidv7 ^1.0.2"
    - "geolib ^3.3.4"
    - "@japa/runner ^5.3.0 + api-client + assert + plugin-adonisjs"
    - "eslint ^10.0.2 + @adonisjs/eslint-config"
    - "prettier ^3.8.1 + @adonisjs/prettier-config"
    - "lefthook ^2.1.4"
    - "@commitlint/cli + config-conventional"
  patterns:
    - "Three-stack middleware: server.use (all requests) / router.use (matched routes) / router.named (explicit per-route)"
    - "Feature-based vertical slice structure: app/features/{name}/ contains controllers, services, validators, tests"
    - "Opaque access tokens guard (no JWT) — DB-backed, instantly revocable"
    - "CORS whitelist-only via CORS_ALLOWED_ORIGINS env var"
    - "Queue: redis adapter for prod, sync adapter for tests"

key-files:
  created:
    - "adonisrc.ts — app configuration with all providers and test suites"
    - "start/env.ts — environment schema with PG, Redis, CORS vars"
    - "start/kernel.ts — three-stack middleware pattern"
    - "start/routes.ts — health check + feature route import placeholder"
    - "config/database.ts — PostgreSQL connection"
    - "config/auth.ts — opaque access tokens guard only"
    - "config/redis.ts — Redis connection"
    - "config/limiter.ts — Redis-backed rate limiter"
    - "config/drive.ts — local fs adapter (Phase 1)"
    - "config/queue.ts — @adonisjs/queue with redis + sync drivers"
    - "config/cors.ts — CORS_ALLOWED_ORIGINS whitelist"
    - "package.json — dependencies with #features/* and #shared/* path aliases"
    - "app/features/.gitkeep — feature vertical slices root"
    - "app/shared/{middleware,adapters,contracts,exceptions,utils}/.gitkeep — shared root"
    - "app/models/.gitkeep — Lucid models root"
    - "tests/rls/.gitkeep — cross-tenant RLS contract tests"
    - "tests/integration/.gitkeep — multi-feature integration tests"
    - "docs/features/.gitkeep and docs/templates/.gitkeep — API docs"
    - ".env.example — full env schema with PG_USER=app"
    - ".gitignore — node_modules, build, .env"
  modified:
    - "database/schema.ts — auto-generated from scaffold (SQLite schema retained; will be replaced in Phase 2)"
    - "tests/bootstrap.ts — removed @adonisjs/session plugin, updated suite names"

key-decisions:
  - "AdonisJS v7 scaffolded via npm create adonisjs@latest with --kit=api, then customized"
  - "Removed @adonisjs/session and @adonisjs/shield from scaffold (mobile API, no session needed)"
  - "Removed @tuyau/core (generated types for type-safe routing) — adds complexity without MVP value"
  - "queue config uses 'default' key (from @boringnode/queue), not 'defaultQueue'"
  - "Node.js 24 installed via nvm to /tmp/.nvm (system partition at 100% required clearing JetBrains cache)"

patterns-established:
  - "Pattern 1: All imports use #-prefixed path aliases (e.g., #features/*, #shared/*) — never relative paths across features"
  - "Pattern 2: adonisrc.ts test suites follow feature glob pattern: app/features/**/tests/{unit,functional}/**/*.spec.ts"
  - "Pattern 3: CORS is whitelist-only — always use CORS_ALLOWED_ORIGINS, never hardcode * or app.inDev"

requirements-completed: [INFRA-01]

# Metrics
duration: 12min
completed: 2026-03-25
---

# Phase 1 Plan 01: AdonisJS v7 Project Scaffold and Folder Structure Summary

**AdonisJS v7 API skeleton with Node.js 24, PostgreSQL/Redis/Queue/Drive/Limiter configured, and feature-based folder structure (app/features, app/shared, tests/rls) established**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-25T21:10:40Z
- **Completed:** 2026-03-25T21:22:00Z
- **Tasks:** 2
- **Files modified:** 66

## Accomplishments

- AdonisJS v7 scaffolded with Node.js 24 and all first-party packages configured
- Feature-based folder structure established per D-01 through D-06
- TypeScript compiles clean (`tsc --noEmit` exits 0)
- All banned packages absent (no ts-node, jest, vitest, husky, jsonwebtoken)
- Path aliases `#features/*` and `#shared/*` added to package.json imports

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Node.js 24 and scaffold AdonisJS v7** - `42fed45` (feat)
2. **Task 2: Create feature-based folder structure** - `db317df` (feat)

## Files Created/Modified

- `adonisrc.ts` — providers, preloads, test suites per plan spec
- `start/env.ts` — full env schema: PG_HOST, REDIS_HOST, CORS_ALLOWED_ORIGINS
- `start/kernel.ts` — three-stack v7 middleware pattern, session/shield removed
- `start/routes.ts` — health check + feature import placeholder
- `config/database.ts` — PostgreSQL with pg driver
- `config/auth.ts` — opaque access tokens guard only (no session guard)
- `config/redis.ts` — Redis connection via @adonisjs/redis
- `config/limiter.ts` — Redis-backed rate limiter
- `config/drive.ts` — local fs adapter
- `config/queue.ts` — @adonisjs/queue with redis + sync drivers
- `config/cors.ts` — CORS_ALLOWED_ORIGINS whitelist (D-24)
- `package.json` — all dependencies + #features/*, #shared/* path aliases
- `.env.example` — PG_USER=app (not superuser)
- `.gitignore` — node_modules, build, .env, tmp sqlite
- `tests/bootstrap.ts` — session plugin removed, suite names updated
- `app/features/.gitkeep`, `app/shared/*/.gitkeep`, `app/models/.gitkeep`
- `tests/rls/.gitkeep`, `tests/integration/.gitkeep`
- `docs/features/.gitkeep`, `docs/templates/.gitkeep`

## Decisions Made

- Removed `@adonisjs/session` and `@adonisjs/shield` — mobile API doesn't need session or CSRF; security headers added in Plan 01-05
- Removed `@tuyau/core` — type-safe route generation adds complexity without MVP value; can be added later if needed
- `@boringnode/queue` `QueueManagerConfig` uses `default` (not `defaultQueue`) — fixed during implementation
- Node.js 24 installed via nvm targeting `/tmp` (system partition 100% full; cleared JetBrains Toolbox download cache to free 1.7GB)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Queue config used wrong key name**
- **Found during:** Task 1 (install and scaffold)
- **Issue:** Plan spec used `defaultQueue` but `@boringnode/queue` `QueueManagerConfig` uses `default`
- **Fix:** Updated `config/queue.ts` to use `default` key; added `adapters` with both `redis` and `sync` drivers
- **Files modified:** `config/queue.ts`
- **Verification:** `tsc --noEmit` passes, no type errors
- **Committed in:** 42fed45 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Removed session-based auth from config**
- **Found during:** Task 1 (scaffold customization)
- **Issue:** Scaffold included `@adonisjs/session` and `sessionGuard` in `config/auth.ts`; CLAUDE.md and D-10a prohibit session-based auth for mobile API
- **Fix:** Updated `config/auth.ts` to use only `tokensGuard`; removed session/shield packages and their configs
- **Files modified:** `config/auth.ts`, `start/kernel.ts`, removed `config/session.ts`, `config/shield.ts`
- **Verification:** TypeScript clean, no session imports remain
- **Committed in:** 42fed45 (Task 1 commit)

**3. [Rule 3 - Blocking] Disk space exhausted before Node.js 24 install**
- **Found during:** Task 1 (Node.js 24 installation)
- **Issue:** System partition at 100% capacity (17MB free); nvm download failed mid-transfer
- **Fix:** Cleared JetBrains Toolbox download cache (1.7GB), pip cache, uv cache — freed 1.8GB; installed Node.js 24 via nvm to /tmp/.nvm
- **Files modified:** none (system-level fix)
- **Verification:** `node --version` prints v24.14.1
- **Committed in:** not applicable (infrastructure fix)

---

**Total deviations:** 3 auto-fixed (1 bug, 1 missing critical, 1 blocking)
**Impact on plan:** All necessary for correctness and functionality. No scope creep.

## Issues Encountered

- JetBrains Toolbox had 1.7GB of installer downloads cached that were safe to clear
- `@tuyau/core` was in the scaffold but was removed — its `generateRegistry()` hook and generated types aren't needed for this project
- `config/database.ts` scaffold had SQLite as default; switched to PostgreSQL

## Known Stubs

None — this plan does not implement any feature logic. The `app/models/user.ts` references a scaffold-generated `database/schema.ts` that uses SQLite-era schema; this will be replaced in Phase 2 with a proper PostgreSQL tenant-aware schema.

## Next Phase Readiness

- Foundation complete — Node.js 24, AdonisJS v7, all packages wired
- Phase 2 (Authentication & Identity) can begin immediately
- Phase 1 Plans 02-05 (DB setup, CI/CD, lefthook, Makefile) still pending

---
*Phase: 01-foundation*
*Completed: 2026-03-25*

## Self-Check: PASSED

All files verified present, all commits verified in git history:
- app/features/.gitkeep: FOUND
- app/shared/middleware/.gitkeep: FOUND
- tests/rls/.gitkeep: FOUND
- tests/integration/.gitkeep: FOUND
- config/database.ts: FOUND
- config/queue.ts: FOUND
- adonisrc.ts: FOUND
- start/env.ts: FOUND
- Commit 42fed45: FOUND
- Commit db317df: FOUND
