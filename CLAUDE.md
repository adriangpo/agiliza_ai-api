<!-- GSD:project-start source:PROJECT.md -->
## Project

**Agiliza Aí API**

A multi-tenant REST API built with Adonis.js for "Agiliza Aí" — a municipal citizen-reporting system that lets city residents submit geolocated infrastructure complaints and managers triage, moderate, and resolve them. Each municipality is an isolated tenant. The API serves a mobile-first citizen app and a manager dashboard.

**Core Value:** Citizens can submit a geolocated complaint and receive status updates — everything else (clustering, moderation, scoring) amplifies this but cannot replace it.

### Constraints

- **Tech stack:** Adonis.js v7 (Node.js 24 required) — framework conventions must be followed, not worked around
- **Testing:** TDD is non-negotiable — no feature ships without tests written first
- **Security:** RLS tenant isolation must be tested; any cross-tenant data leak is a critical failure
- **Coupling:** No file should do too much — services, controllers, validators, and policies are always separate files
- **Lint:** ESLint + Prettier enforced from day one; CI must fail on lint errors
- **Versions:** Always use the latest stable version of all dependencies; never pin to outdated packages
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Core Framework
### AdonisJS v7 (Node.js 24 required)
- `@adonisjs/core` — HTTP server, router, middleware pipeline, DI container
- `@adonisjs/lucid` — Lucid ORM (prompt during scaffold)
- `@vinejs/vine` — validation (bundled; do not install `@adonisjs/validator`)
- `@adonisjs/auth` — authentication with opaque access tokens (prompt during scaffold)
- `japa` + `@japa/api-client` — test runner (included automatically)
## Database & ORM
### Lucid ORM (PostgreSQL driver)
| Package | Version (npm-verified 2026-03-24) | Role |
|---|---|---|
| `@adonisjs/lucid` | `^22.2.0` | ORM, migrations, seeders, query builder |
| `pg` | `^8.20.0` | PostgreSQL driver required by Lucid |
# Select: PostgreSQL
### PostGIS
| Package | Version (npm-verified 2026-03-24) | Role |
|---|---|---|
| `postgis` (DB extension) | `3.x` | Geospatial queries — enable at DB level |
| `knex-postgis` | `^0.14.3` | Knex/Lucid raw PostGIS helpers |
## Authentication
### @adonisjs/auth with opaque access tokens
| Package | Version (npm-verified 2026-03-24) | Role |
|---|---|---|
| `@adonisjs/auth` | `^10.0.0` | Auth scaffolding, access token guard, Lucid user provider |
**Note:** AdonisJS v7 auth uses opaque DB-backed access tokens (not JWT). The JWT guard was removed in auth v10. Tenant context is loaded from the user DB record on each authenticated request — not from a token payload claim. This is more secure (tokens are instantly revocable server-side).
# Select: Access tokens guard + Lucid user provider
### OAuth / Social Login
| Package | Version (npm-verified 2026-03-24) | Role |
|---|---|---|
| `@adonisjs/ally` | `^6.0.0` | OAuth2 social login (Google, Apple) |
## Testing
### Japa (native AdonisJS test runner)
| Package | Version (npm-verified 2026-03-24) | Role |
|---|---|---|
| `@japa/runner` | `^5.3.0` | Core test runner |
| `@japa/api-client` | `^3.2.1` | HTTP assertion client for endpoint tests |
| `@japa/assert` | `^4.2.0` | Assertion library (Chai-compatible) |
| `@japa/plugin-adonisjs` | `^5.2.0` | AdonisJS app lifecycle integration |
- Write the test first, watch it fail, implement until it passes
- Every controller, service, validator, and policy has a test file
- Cross-tenant leakage tests: verify that a request with `tenantId=A` cannot read `tenantId=B` data under any condition
## Linting & Formatting
### ESLint v10 (flat config)
| Package | Version (npm-verified 2026-03-24) | Role |
|---|---|---|
| `eslint` | `^10.1.0` | Linting engine |
| `@adonisjs/eslint-config` | `^3.0.0` | Official AdonisJS ESLint preset |
| `eslint-plugin-unicorn` | latest | Extra code-quality rules |
| `@typescript-eslint/eslint-plugin` | latest compatible | TypeScript-specific rules |
| `@typescript-eslint/parser` | latest compatible | TS parser for ESLint |
- `@typescript-eslint` rules
- Import ordering rules
- AdonisJS-specific patterns
### Prettier
| Package | Version (npm-verified 2026-03-24) | Role |
|---|---|---|
| `prettier` | `^3.8.1` | Code formatting |
| `@adonisjs/prettier-config` | `^1.4.5` | Official AdonisJS Prettier preset |
### Git Hooks
| Package | Version (npm-verified 2026-03-24) | Role |
|---|---|---|
| `lefthook` | `^2.1.4` | Fast binary git hook runner (no Node.js runtime dependency) |
## Storage & Media
### @adonisjs/drive
| Package | Version (npm-verified 2026-03-24) | Role |
|---|---|---|
| `@adonisjs/drive` | `^4.0.0` | Filesystem/S3/GCS abstraction (v7 compatible) |
| Package | Version (npm-verified 2026-03-24) | Role |
|---|---|---|
| `sharp` | `^0.34.5` | Image processing: EXIF strip, resize |
## Background Jobs / Queues
### @adonisjs/queue (backed by @boringnode/queue)
| Package | Version (npm-verified 2026-03-24) | Role |
|---|---|---|
| `@adonisjs/queue` | `^0.6.0` | Queue integration for AdonisJS v7 — uses `@boringnode/queue` internally, NOT BullMQ |
| `@adonisjs/redis` | `^10.0.0` | Redis client for AdonisJS v7 (required by queue Redis adapter) |

**Note:** `@adonisjs/queue` v0.6.0 depends on `@boringnode/queue ^0.5.0`, which provides Redis, Database, and Sync adapters. Do NOT install `bullmq` or `ioredis` directly — `@adonisjs/queue` + `@adonisjs/redis` covers all job processing needs. The Sync adapter is ideal for test environments.
- ML image screening HTTP calls (async, non-blocking path for submissions)
- Cluster detection after each submission (idempotent job, RNF-04)
- Push notification dispatch (RN-019)
- Progressive restriction evaluation for malicious flagging (RN-020)
- Redis-backed = durable across restarts
- Built-in retry, backoff — idempotency strategy for cluster detection to be evaluated in Phase 4
## Rate Limiting
### @adonisjs/limiter
| Package | Version (npm-verified 2026-03-24) | Role |
|---|---|---|
| `@adonisjs/limiter` | `^3.0.1` | Rate limiting middleware |
| Rule | Limit | Window | Key |
|------|-------|--------|-----|
| Publications (RN-002) | 5 | 24h rolling | `user:{userId}:publications` |
| Flags per user (RN-015) | — | 1h | `user:{userId}:flags` |
| Flags per IP (RN-015) | — | 1h | `ip:{ip}:flags` |
| General API | Configurable | — | `ip:{ip}` |
## Geospatial
### PostGIS (database extension)
| Package | Version (npm-verified 2026-03-24) | Role |
|---|---|---|
| `geolib` | `^3.3.4` | Haversine distance calc in JS |
## What NOT to Use (and why)
| Package / Pattern | Why Not |
|---|---|
| Any `@adonisjs/*` v5 or v6 package | v5/v6 packages use the old IoC container and peer-dep on `@adonisjs/core ^5.x` or `^6.x`. Incompatible with v7. Will appear to install but fail at runtime. |
| `@adonisjs/validator` | Legacy v5 package. v7 uses `@vinejs/vine` — already bundled. |
| `jsonwebtoken` / `jose` for JWT auth | AdonisJS v7 auth uses opaque access tokens (auth v10). JWT guard was removed. Do not add a parallel JWT implementation — use auth v10's access tokens guard. |
| `passport` | Node.js middleware pattern; fights AdonisJS HTTP context and DI container. Use `@adonisjs/auth` + `@adonisjs/ally`. |
| `jest` / `vitest` | Require custom setup fighting AdonisJS app lifecycle. Use Japa — it is the official runner and handles DB lifecycle correctly. |
| `prisma` / `drizzle` | Bypass Lucid conventions (migrations, factories, model events). Lucid is the correct ORM for AdonisJS. |
| `sequelize` | CommonJS-first. Not compatible with AdonisJS v7 ESM conventions. |
| `husky` / `simple-git-hooks` | Project uses `lefthook` (D-19 decision). Lefthook is a fast binary with no Node.js runtime dependency, making hooks faster and more reliable in CI. |
| `.eslintrc.json` | ESLint v8 legacy format. Use `eslint.config.js` flat config (ESLint v10). |
| `eslint-config-airbnb` | Tuned for React/CommonJS. Conflicts with `@adonisjs/eslint-config` on import rules. |
| In-memory rate limiting | Fails in multi-process deployments. Use Redis-backed `@adonisjs/limiter`. |
| In-process job queues | Not durable. Use `@adonisjs/queue` (Redis adapter) for durable async jobs. |
| Session-based auth | Mobile clients require stateless tokens. Use opaque access tokens via `@adonisjs/auth` v10. |
| `ioredis` directly | Use `@adonisjs/redis` v10 which wraps ioredis with AdonisJS DI and lifecycle management. |
## Version Summary Table
| Package | Pinned Version | Category | Confidence |
|---|---|---|---|
| `@adonisjs/core` | `^7.1.1` | Framework | HIGH |
| `@adonisjs/lucid` | `^22.2.0` | ORM | HIGH |
| `pg` | `^8.20.0` | DB driver | HIGH |
| `@adonisjs/auth` | `^10.0.0` | Auth | HIGH |
| `@adonisjs/ally` | `^6.0.0` | OAuth | HIGH |
| `@vinejs/vine` | `^4.3.0` | Validation | HIGH |
| `@adonisjs/drive` | `^4.0.0` | Storage | HIGH |
| `@adonisjs/limiter` | `^3.0.1` | Rate limiting | HIGH |
| `@adonisjs/queue` | `^0.6.0` | Job queues | HIGH |
| `@adonisjs/redis` | `^10.0.0` | Redis client | HIGH |
| `@japa/runner` | `^5.3.0` | Test runner | HIGH |

| `@japa/api-client` | `^3.2.1` | HTTP test client | HIGH |
| `@japa/assert` | `^4.2.0` | Assertions | HIGH |
| `@japa/plugin-adonisjs` | `^5.2.0` | AdonisJS test integration | HIGH |
| `eslint` | `^10.1.0` | Linting | HIGH |
| `@adonisjs/eslint-config` | `^3.0.0` | ESLint preset | HIGH |
| `prettier` | `^3.8.1` | Formatting | HIGH |
| `@adonisjs/prettier-config` | `^1.4.5` | Prettier preset | HIGH |
| `lefthook` | `^2.1.4` | Git hooks | HIGH |
| `sharp` | `^0.34.5` | Image/EXIF processing | HIGH |
| `@boringnode/queue` | (via @adonisjs/queue) | Queue engine | HIGH |
| `geolib` | `^3.3.4` | GPS distance validation | HIGH |
| `knex-postgis` | `^0.14.3` | PostGIS helpers (optional) | LOW |
## Installation Reference
### Scaffold
```bash
npm init adonisjs@latest agiliza-ai-api -- --kit=api
# Requires Node.js 24+
```
### Configure first-party packages
### Add supporting packages
### Enable PostGIS
## Sources
- AdonisJS v7 documentation: https://docs.adonisjs.com
- AdonisJS v7 release blog: https://adonisjs.com/blog/v7
- AdonisJS v6→v7 upgrade guide: https://docs.adonisjs.com/v6-to-v7
- AdonisJS GitHub: https://github.com/adonisjs
- `bullmq` documentation: https://docs.bullmq.io
- `sharp` documentation: https://sharp.pixelplumbing.com
- **All versions npm-verified on 2026-03-24** — https://www.npmjs.com
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
