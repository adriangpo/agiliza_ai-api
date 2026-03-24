<!-- GSD:project-start source:PROJECT.md -->
## Project

**Agiliza Aí API**

A multi-tenant REST API built with Adonis.js for "Agiliza Aí" — a municipal citizen-reporting system that lets city residents submit geolocated infrastructure complaints and managers triage, moderate, and resolve them. Each municipality is an isolated tenant. The API serves a mobile-first citizen app and a manager dashboard.

**Core Value:** Citizens can submit a geolocated complaint and receive status updates — everything else (clustering, moderation, scoring) amplifies this but cannot replace it.

### Constraints

- **Tech stack:** Adonis.js v6 — framework conventions must be followed, not worked around
- **Testing:** TDD is non-negotiable — no feature ships without tests written first
- **Security:** RLS tenant isolation must be tested; any cross-tenant data leak is a critical failure
- **Coupling:** No file should do too much — services, controllers, validators, and policies are always separate files
- **Lint:** ESLint + Prettier enforced from day one; CI must fail on lint errors
- **Versions:** Always use the latest stable version of all dependencies; never pin to outdated packages
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Core Framework
### AdonisJS v6
- `@adonisjs/core` — HTTP server, router, middleware pipeline, DI container
- `@adonisjs/lucid` — Lucid ORM (prompt during scaffold)
- `@vinejs/vine` — validation (replaces `@adonisjs/validator` from v5)
- `@adonisjs/auth` — authentication (prompt during scaffold)
- `japa` + `@japa/api-client` — test runner (included automatically)
## Database & ORM
### Lucid ORM (PostgreSQL driver)
| Package | Version (training) | Role |
|---|---|---|
| `@adonisjs/lucid` | `^21.x` | ORM, migrations, seeders, query builder |
| `pg` | `^8.x` | PostgreSQL driver required by Lucid |
# Select: PostgreSQL
### PostGIS
| Package | Version (training) | Role |
|---|---|---|
| `postgis` (DB extension) | `3.x` | Geospatial queries — enable at DB level |
| `knex-postgis` | `^0.14.x` | Knex/Lucid raw PostGIS helpers |
## Authentication
### @adonisjs/auth with JWT guard
| Package | Version (training) | Role |
|---|---|---|
| `@adonisjs/auth` | `^9.x` | Auth scaffolding, guards, user provider |
| `@adonisjs/jwt` | Separate pkg — see note | JWT guard for `@adonisjs/auth` |
# Select: JWT guard + Lucid user provider
### OAuth / Social Login
| Package | Version (training) | Role |
|---|---|---|
| `@adonisjs/ally` | `^5.x` | OAuth2 social login (Google, Apple) |
## Testing
### Japa (native AdonisJS test runner)
| Package | Version (training) | Role |
|---|---|---|
| `@japa/runner` | `^3.x` | Core test runner |
| `@japa/api-client` | `^2.x` | HTTP assertion client for endpoint tests |
| `@japa/assert` | `^3.x` | Assertion library (Chai-compatible) |
| `@japa/plugin-adonisjs` | `^3.x` | AdonisJS app lifecycle integration |
- Write the test first, watch it fail, implement until it passes
- Every controller, service, validator, and policy has a test file
- Cross-tenant leakage tests: verify that a request with `tenantId=A` cannot read `tenantId=B` data under any condition
## Linting & Formatting
### ESLint v9 (flat config)
| Package | Version (training) | Role |
|---|---|---|
| `eslint` | `^9.x` | Linting engine |
| `@adonisjs/eslint-config` | `^2.x` | Official AdonisJS ESLint preset |
| `eslint-plugin-unicorn` | `^55.x` | Extra code-quality rules |
| `@typescript-eslint/eslint-plugin` | `^8.x` | TypeScript-specific rules |
| `@typescript-eslint/parser` | `^8.x` | TS parser for ESLint |
- `@typescript-eslint` rules
- Import ordering rules
- AdonisJS-specific patterns (no `@ioc:` strings, etc.)
### Prettier
| Package | Version (training) | Role |
|---|---|---|
| `prettier` | `^3.x` | Code formatting |
| `@adonisjs/prettier-config` | `^1.x` | Official AdonisJS Prettier preset |
| Package | Version (training) | Role |
|---|---|---|
| `simple-git-hooks` | `^2.x` | Lightweight git hook runner |
| `lint-staged` | `^15.x` | Run linting only on staged files |
## Storage & Media
### @adonisjs/drive
| Package | Version (training) | Role |
|---|---|---|
| `@adonisjs/drive` | `^2.x` | Filesystem/S3/GCS abstraction |
| `@adonisjs/drive-s3` | See note | S3 driver (verify if built-in or separate) |
| Package | Version (training) | Role |
|---|---|---|
| `sharp` | `^0.33.x` | Image processing: EXIF strip, resize |
## Background Jobs / Queues
### @adonisjs/queue (BullMQ-based)
| Package | Version (training) | Role |
|---|---|---|
| `@adonisjs/queue` | — see note | BullMQ integration for AdonisJS v6 |
| `bullmq` | `^5.x` | Queue engine (Redis-backed) |
| `ioredis` | `^5.x` | Redis client required by BullMQ |
- ML image screening HTTP calls (async, non-blocking path for submissions)
- Cluster detection after each submission (idempotent job, RNF-04)
- Push notification dispatch (RN-019)
- Progressive restriction evaluation for malicious flagging (RN-020)
- Redis-backed = durable across restarts
- Built-in retry, backoff, dead-letter queue
- Job deduplication (critical for idempotent cluster detection — RNF-04)
- `@adonisjs/queue` if stable; otherwise direct BullMQ is fine
## Rate Limiting
### @adonisjs/limiter
| Package | Version (training) | Role |
|---|---|---|
| `@adonisjs/limiter` | `^2.x` | Rate limiting middleware |
| Rule | Limit | Window | Key |
|------|-------|--------|-----|
| Publications (RN-002) | 5 | 24h rolling | `user:{userId}:publications` |
| Flags per user (RN-015) | — | 1h | `user:{userId}:flags` |
| Flags per IP (RN-015) | — | 1h | `ip:{ip}:flags` |
| General API | Configurable | — | `ip:{ip}` |
## Geospatial
### PostGIS (database extension)
| Package | Version (training) | Role |
|---|---|---|
| `geolib` | `^3.x` | Haversine distance calc in JS |
## What NOT to Use (and why)
| Package / Pattern | Why Not |
|---|---|
| Any `@adonisjs/*` v5 package | v5 uses `@ioc:` container; incompatible with v6. Will appear to install but fail at runtime. |
| `@adonisjs/validator` | v5 package. v6 uses `@vinejs/vine` — already bundled. Do not install the old validator. |
| `jsonwebtoken` (manual) | `@adonisjs/auth` v9 JWT guard handles token signing/verification. Adding `jsonwebtoken` directly creates dual JWT implementations. |
| `passport` | Node.js middleware pattern; fights AdonisJS HTTP context and DI container. Use `@adonisjs/auth` + `@adonisjs/ally`. |
| `jest` / `vitest` | Require custom setup fighting AdonisJS app lifecycle. Use Japa — it is the official runner and handles DB lifecycle correctly. |
| `prisma` / `drizzle` | Bypass Lucid conventions (migrations, factories, model events). Lucid is the correct ORM for AdonisJS. |
| `sequelize` | v5 era, CommonJS-first. Not compatible with AdonisJS v6 ESM conventions. |
| `husky` | AdonisJS scaffold uses `simple-git-hooks`. Husky requires an install script that breaks in some CI environments. |
| `.eslintrc.json` | ESLint v8 legacy format. Use `eslint.config.js` flat config (ESLint v9). |
| `eslint-config-airbnb` | Tuned for React/CommonJS. Conflicts with `@adonisjs/eslint-config` on import rules. |
| In-memory rate limiting | Fails in multi-process deployments. Use Redis-backed `@adonisjs/limiter`. |
| In-process job queues | Not durable. Use BullMQ + Redis for cluster detection and async ML calls. |
| Session-based auth | PROJECT.md explicitly mandates JWT. Sessions add complexity for mobile clients and are stateful. |
## Version Summary Table
| Package | Pinned Version | Category | Confidence |
|---|---|---|---|
| `@adonisjs/core` | `^6.12.0` | Framework | MEDIUM |
| `@adonisjs/lucid` | `^21.0.0` | ORM | MEDIUM |
| `pg` | `^8.11.0` | DB driver | HIGH |
| `@adonisjs/auth` | `^9.0.0` | Auth | MEDIUM |
| `@adonisjs/ally` | `^5.0.0` | OAuth | MEDIUM |
| `@vinejs/vine` | `^2.0.0` | Validation | MEDIUM |
| `@adonisjs/drive` | `^2.0.0` | Storage | MEDIUM |
| `@adonisjs/limiter` | `^2.0.0` | Rate limiting | MEDIUM |
| `@japa/runner` | `^3.0.0` | Test runner | MEDIUM |
| `@japa/api-client` | `^2.0.0` | HTTP test client | MEDIUM |
| `@japa/assert` | `^3.0.0` | Assertions | MEDIUM |
| `@japa/plugin-adonisjs` | `^3.0.0` | AdonisJS test integration | MEDIUM |
| `eslint` | `^9.0.0` | Linting | HIGH |
| `@adonisjs/eslint-config` | `^2.0.0` | ESLint preset | MEDIUM |
| `prettier` | `^3.0.0` | Formatting | HIGH |
| `@adonisjs/prettier-config` | `^1.0.0` | Prettier preset | MEDIUM |
| `simple-git-hooks` | `^2.0.0` | Git hooks | HIGH |
| `lint-staged` | `^15.0.0` | Staged-file linting | HIGH |
| `sharp` | `^0.33.0` | Image/EXIF processing | HIGH |
| `bullmq` | `^5.0.0` | Job queues | HIGH |
| `ioredis` | `^5.0.0` | Redis client | HIGH |
| `geolib` | `^3.3.0` | GPS distance validation | HIGH |
| `knex-postgis` | `^0.14.0` | PostGIS helpers (optional) | LOW |
## Installation Reference
### Scaffold
### Configure first-party packages
### Add supporting packages
### Enable PostGIS
## Sources
- AdonisJS v6 documentation: https://docs.adonisjs.com (training data, August 2025)
- AdonisJS GitHub: https://github.com/adonisjs (training data)
- `bullmq` documentation: https://docs.bullmq.io (training data)
- `sharp` documentation: https://sharp.pixelplumbing.com (training data)
- ESLint v9 flat config announcement: https://eslint.org/blog/2022/08/new-config-system-part-1/ (training data)
- **Verify all versions on npm registry before use** — https://www.npmjs.com
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
