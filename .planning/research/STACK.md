# Stack Research: Agiliza Aí API

**Project:** Multi-tenant municipal citizen-reporting REST API
**Researched:** 2026-03-23 (original) — **SUPERSEDED 2026-03-24**
**⚠ OUTDATED:** This document was written for AdonisJS v6. The project has switched to **AdonisJS v7** (Node.js 24 required). All package versions below are outdated. See `.planning/phases/01-foundation/01-RESEARCH.md` for the current v7-verified stack and `CLAUDE.md` for the canonical version table (all versions npm-verified 2026-03-24).

**Key v7 changes vs what's written below:**
- `@adonisjs/core` → 7.1.1 (not 6.x)
- `@adonisjs/auth` → 10.0.0, opaque tokens only (JWT guard removed)
- `@adonisjs/queue` → 0.6.0 using `@boringnode/queue` (not BullMQ)
- `@adonisjs/drive` → 4.0.0 (v2 is v5-era, v3 is v6-era)
- `eslint` → 10.1.0 (not v9)
- `simple-git-hooks` → replaced by `lefthook` (D-19)
- Node.js 24 required (machine currently runs 22.22.0 — install nodejs24 via dnf)

---

## Core Framework

### AdonisJS v6

**Package:** `@adonisjs/core`
**Version (training data):** `^6.12.x` — verify current patch on npm
**Why:** The project spec mandates AdonisJS v6. v6 is a ground-up rewrite from v5: ESM-first, TypeScript-native, no legacy `@ioc:` container syntax, flat config instead of provider registration soup. The `configure` CLI command replaces manual wiring for every first-party package. v5 packages are **incompatible** — they still use the old IoC container and will silently break.

**Scaffold command:**

```bash
npm init adonisjs@latest agiliza-ai-api -- --kit=api
```

The `--kit=api` flag gives you a lean REST-only starter: no views, no session, no Vite. This is correct for a mobile-first API.

**What the api kit includes by default:**
- `@adonisjs/core` — HTTP server, router, middleware pipeline, DI container
- `@adonisjs/lucid` — Lucid ORM (prompt during scaffold)
- `@vinejs/vine` — validation (replaces `@adonisjs/validator` from v5)
- `@adonisjs/auth` — authentication (prompt during scaffold)
- `japa` + `@japa/api-client` — test runner (included automatically)

**What to add manually after scaffold:**
See sections below.

---

## Database & ORM

### Lucid ORM (PostgreSQL driver)

| Package | Version (training) | Role |
|---|---|---|
| `@adonisjs/lucid` | `^21.x` | ORM, migrations, seeders, query builder |
| `pg` | `^8.x` | PostgreSQL driver required by Lucid |

**Configuration:**

```bash
node ace configure @adonisjs/lucid
# Select: PostgreSQL
```

**Why Lucid over alternatives:** Lucid is the canonical AdonisJS ORM. It integrates with the DI container, migrations, factory system, and test database lifecycle out of the box. Raw Prisma or Drizzle would require bypassing AdonisJS conventions at every layer — avoid.

**Lucid + PostgreSQL RLS — critical configuration:**

The PROJECT.md requires RLS policies enforced at DB level. Lucid does NOT natively set `app.current_tenant_id` session variables. You need a custom database hook:

```typescript
// In a base model or middleware:
import db from '@adonisjs/lucid/services/db'

// Before each request, after resolving tenant:
await db.rawQuery(`SET app.current_tenant_id = '${tenantId}'`)
```

Implement this as a named middleware (`SetTenantContext`) that runs before any controller. Test cross-tenant leakage exhaustively as the project requires.

**Migrations:** Lucid migrations with `node ace migration:run`. RLS policy SQL goes in dedicated migration files using `db.rawQuery()`.

### PostGIS

| Package | Version (training) | Role |
|---|---|---|
| `postgis` (DB extension) | `3.x` | Geospatial queries — enable at DB level |
| `knex-postgis` | `^0.14.x` | Knex/Lucid raw PostGIS helpers |

**Why:** The 200m/50m GPS constraint validation (RN-003, US-01) and the 50m/7-day cluster detection (RN-006) require `ST_DWithin` queries. Lucid's raw query builder handles PostGIS fine; `knex-postgis` adds typed helpers but is optional if you write raw SQL.

**Confidence: MEDIUM** — verify `knex-postgis` compatibility with Lucid v21 query builder before adopting; raw SQL is always a safe fallback.

---

## Authentication

### @adonisjs/auth with JWT guard

| Package | Version (training) | Role |
|---|---|---|
| `@adonisjs/auth` | `^9.x` | Auth scaffolding, guards, user provider |
| `@adonisjs/jwt` | Separate pkg — see note | JWT guard for `@adonisjs/auth` |

**Critical v6 note:** In AdonisJS v6, the JWT guard was extracted from `@adonisjs/auth` into a separate package. The package is `@adonisjs/jwt` (verify exact name on npm — may appear as `@adonisjs/auth` sub-export or community package). As of training data, the official JWT guard is included in `@adonisjs/auth` v9 as a named guard. Verify the exact import path in current docs before writing auth code.

**Configuration:**

```bash
node ace configure @adonisjs/auth
# Select: JWT guard + Lucid user provider
```

**Why JWT over sessions:** PROJECT.md mandates this. API is mobile-first; stateless JWT avoids cookie/session complexity on native clients. Each token carries tenant context in the payload, allowing the `SetTenantContext` middleware to validate without a DB lookup per request.

**JWT payload design for multi-tenancy:**

```typescript
// Token payload shape
{
  sub: userId,
  tenantId: string,
  role: 'citizen' | 'manager' | 'admin',
  iat: number,
  exp: number
}
```

Never trust `tenantId` from a request header alone — extract it exclusively from the verified JWT payload to prevent tenant impersonation.

### OAuth / Social Login

| Package | Version (training) | Role |
|---|---|---|
| `@adonisjs/ally` | `^5.x` | OAuth2 social login (Google, Apple) |

**Configuration:**

```bash
node ace configure @adonisjs/ally
```

**Supported drivers:** Google, GitHub, Twitter, Discord, Spotify, LinkedIn, Facebook. Apple Sign-In requires `apple` driver — verify it is included in the current `@adonisjs/ally` v5 or if a community package is needed.

**Why Ally:** Official AdonisJS package, v6-compatible, integrates with the same DI container and HTTP context as everything else. No manual OAuth flow plumbing.

**Flow for mobile (important):** Mobile clients perform OAuth on-device and send an authorization code or ID token to the API. The API exchanges it server-side. Ally supports this server-side exchange pattern.

---

## Testing

### Japa (native AdonisJS test runner)

| Package | Version (training) | Role |
|---|---|---|
| `@japa/runner` | `^3.x` | Core test runner |
| `@japa/api-client` | `^2.x` | HTTP assertion client for endpoint tests |
| `@japa/assert` | `^3.x` | Assertion library (Chai-compatible) |
| `@japa/plugin-adonisjs` | `^3.x` | AdonisJS app lifecycle integration |

**Why Japa over Jest/Vitest:** Japa is AdonisJS-native. It boots the AdonisJS app correctly (DI container, migrations, seeders), manages test database transactions, and tears down cleanly. Jest/Vitest require custom setup that fights the framework — Japa is a first-class citizen.

**Test database strategy:**

```typescript
// tests/bootstrap.ts
import { configure } from '@japa/runner'

configure({
  plugins: [pluginAdonisJs(app)],
  // Each test wraps in a transaction, rolled back after
})
```

Use `testUtils.db().truncate()` or `testUtils.db().migrate()` in `suite.setup()`. Never run tests against the production database.

**TDD discipline (PROJECT.md requirement):**
- Write the test first, watch it fail, implement until it passes
- Every controller, service, validator, and policy has a test file
- Cross-tenant leakage tests: verify that a request with `tenantId=A` cannot read `tenantId=B` data under any condition

**Test structure (feature-based):**

```
app/
  complaints/
    complaints_controller.test.ts
    complaints_service.test.ts
    complaints_validator.test.ts
```

---

## Linting & Formatting

### ESLint v9 (flat config)

| Package | Version (training) | Role |
|---|---|---|
| `eslint` | `^9.x` | Linting engine |
| `@adonisjs/eslint-config` | `^2.x` | Official AdonisJS ESLint preset |
| `eslint-plugin-unicorn` | `^55.x` | Extra code-quality rules |
| `@typescript-eslint/eslint-plugin` | `^8.x` | TypeScript-specific rules |
| `@typescript-eslint/parser` | `^8.x` | TS parser for ESLint |

**Flat config format (eslint.config.ts or eslint.config.js):**

AdonisJS v6 ships with ESLint v9 flat config by default when you scaffold with `@adonisjs/eslint-config`. Do NOT use `.eslintrc.json` — that is the legacy format for ESLint v8 and below. The flat config uses `eslint.config.js` (or `.ts`) at the project root.

```javascript
// eslint.config.js
import adonisjs from '@adonisjs/eslint-config'
export default adonisjs()
```

**`@adonisjs/eslint-config` includes:**
- `@typescript-eslint` rules
- Import ordering rules
- AdonisJS-specific patterns (no `@ioc:` strings, etc.)

**Do not add:** `eslint-config-airbnb` — it conflicts with the AdonisJS preset and is tuned for React/CommonJS patterns.

### Prettier

| Package | Version (training) | Role |
|---|---|---|
| `prettier` | `^3.x` | Code formatting |
| `@adonisjs/prettier-config` | `^1.x` | Official AdonisJS Prettier preset |

```json
// .prettierrc (or package.json "prettier" field)
"@adonisjs/prettier-config"
```

**Why use the official preset:** Keeps formatting consistent with how AdonisJS maintainers format the framework internals and docs. Avoids configuration drift.

**Git hooks:**

| Package | Version (training) | Role |
|---|---|---|
| `simple-git-hooks` | `^2.x` | Lightweight git hook runner |
| `lint-staged` | `^15.x` | Run linting only on staged files |

AdonisJS scaffold sets up `simple-git-hooks` + `lint-staged` by default. Prefer this over Husky — it is simpler, has no install scripts, and is what the official scaffold uses.

```json
// package.json
{
  "simple-git-hooks": {
    "pre-commit": "npx lint-staged"
  },
  "lint-staged": {
    "*.ts": ["eslint --fix", "prettier --write"]
  }
}
```

---

## Storage & Media

### @adonisjs/drive

| Package | Version (training) | Role |
|---|---|---|
| `@adonisjs/drive` | `^2.x` | Filesystem/S3/GCS abstraction |
| `@adonisjs/drive-s3` | See note | S3 driver (verify if built-in or separate) |

**Configuration:**

```bash
node ace configure @adonisjs/drive
```

**Why Drive:** PROJECT.md requires private bucket storage for original EXIF images (RN-016) and public delivery with EXIF stripped (RNF-02). Drive gives a single API that works against local disk in tests and S3/compatible storage in production. Swap drivers via config, no code changes.

**EXIF stripping — required additional package:**

| Package | Version (training) | Role |
|---|---|---|
| `sharp` | `^0.33.x` | Image processing: EXIF strip, resize |

`sharp` is the industry standard for Node.js image processing. Use it to strip EXIF before writing to the public bucket:

```typescript
const strippedBuffer = await sharp(inputBuffer)
  .withMetadata(false) // strips EXIF
  .toBuffer()
```

Store the original (with EXIF) in the private bucket and the stripped version in the public bucket. This satisfies both RN-016 (private EXIF access for moderators) and RNF-02 (public EXIF-free delivery).

**Confidence: HIGH** — `sharp` is stable, widely used, and actively maintained.

---

## Background Jobs / Queues

### @adonisjs/queue (BullMQ-based)

| Package | Version (training) | Role |
|---|---|---|
| `@adonisjs/queue` | — see note | BullMQ integration for AdonisJS v6 |
| `bullmq` | `^5.x` | Queue engine (Redis-backed) |
| `ioredis` | `^5.x` | Redis client required by BullMQ |

**Confidence note: MEDIUM.** As of training data, an official `@adonisjs/queue` package was in development or early release. Verify its current status. If not yet stable, use `bullmq` directly with a custom provider:

```typescript
// providers/queue_provider.ts
import { Queue } from 'bullmq'
import { ApplicationService } from '@adonisjs/core/types'

export default class QueueProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('queue', () => new Queue('default', {
      connection: { host: env.get('REDIS_HOST'), port: env.get('REDIS_PORT') }
    }))
  }
}
```

**What needs queues in this project:**
- ML image screening HTTP calls (async, non-blocking path for submissions)
- Cluster detection after each submission (idempotent job, RNF-04)
- Push notification dispatch (RN-019)
- Progressive restriction evaluation for malicious flagging (RN-020)

**Why BullMQ over alternatives:**
- Redis-backed = durable across restarts
- Built-in retry, backoff, dead-letter queue
- Job deduplication (critical for idempotent cluster detection — RNF-04)
- `@adonisjs/queue` if stable; otherwise direct BullMQ is fine

**Do NOT use:** in-process queues, `setImmediate`, or cron-based polling for these jobs. Cluster detection under concurrent submissions (RNF-04) requires an atomic queue.

---

## Rate Limiting

### @adonisjs/limiter

| Package | Version (training) | Role |
|---|---|---|
| `@adonisjs/limiter` | `^2.x` | Rate limiting middleware |

**Configuration:**

```bash
node ace configure @adonisjs/limiter
```

**Why `@adonisjs/limiter`:** Official AdonisJS v6 package. Supports Redis-backed stores (required for multi-process production), per-user and per-IP strategies, and route-level middleware application.

**Rate limits to implement (from PROJECT.md):**

| Rule | Limit | Window | Key |
|------|-------|--------|-----|
| Publications (RN-002) | 5 | 24h rolling | `user:{userId}:publications` |
| Flags per user (RN-015) | — | 1h | `user:{userId}:flags` |
| Flags per IP (RN-015) | — | 1h | `ip:{ip}:flags` |
| General API | Configurable | — | `ip:{ip}` |

**Important:** Rate limiting must be backed by Redis (not in-memory) for correctness across multiple API processes. Configure `@adonisjs/limiter` to use the same Redis instance as BullMQ.

---

## Geospatial

### PostGIS (database extension)

No Node.js package required — PostGIS is a PostgreSQL extension enabled at the database level:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

**Geospatial queries via Lucid raw:**

```typescript
// 50m cluster detection (RN-006)
const nearby = await db.rawQuery(`
  SELECT id FROM reports
  WHERE
    tenant_id = ?
    AND category = ?
    AND created_at > NOW() - INTERVAL '7 days'
    AND ST_DWithin(
      location::geography,
      ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography,
      50
    )
`, [tenantId, category, lon, lat])
```

**Why raw SQL for geospatial:** Lucid query builder has no PostGIS type awareness. Raw queries are cleaner and safer than trying to hack PostGIS functions through the ORM abstraction. Encapsulate them in a `GeospatialService` to keep controllers clean.

**GPS validation at submission (RN-003, US-01):**

GPS distance and accuracy validation (200m from pinned location, 50m accuracy) should happen in the validator or service layer — not the database. Use the Haversine formula or a small library:

| Package | Version (training) | Role |
|---|---|---|
| `geolib` | `^3.x` | Haversine distance calc in JS |

`geolib` is tiny, dependency-free, and well-tested. Use it for submission validation before the record is written to the DB.

---

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

---

## Version Summary Table

**Confidence:** MEDIUM — based on training data (cutoff August 2025). Verify each package on npm before committing to `package.json`. AdonisJS moves fast on patch versions.

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

---

## Installation Reference

### Scaffold

```bash
npm init adonisjs@latest agiliza-ai-api -- --kit=api
cd agiliza-ai-api
```

### Configure first-party packages

```bash
node ace configure @adonisjs/lucid    # select PostgreSQL
node ace configure @adonisjs/auth     # select JWT guard + Lucid provider
node ace configure @adonisjs/ally     # select Google + Apple drivers
node ace configure @adonisjs/drive    # select S3 driver
node ace configure @adonisjs/limiter  # select Redis store
```

### Add supporting packages

```bash
npm install pg bullmq ioredis sharp geolib
npm install -D eslint @adonisjs/eslint-config prettier @adonisjs/prettier-config lint-staged simple-git-hooks
```

### Enable PostGIS

```sql
-- In a migration file, not raw psql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
```

---

## Sources

- AdonisJS v6 documentation: https://docs.adonisjs.com (training data, August 2025)
- AdonisJS GitHub: https://github.com/adonisjs (training data)
- `bullmq` documentation: https://docs.bullmq.io (training data)
- `sharp` documentation: https://sharp.pixelplumbing.com (training data)
- ESLint v9 flat config announcement: https://eslint.org/blog/2022/08/new-config-system-part-1/ (training data)
- **Verify all versions on npm registry before use** — https://www.npmjs.com

*Note: All findings are HIGH confidence on architecture/pattern choices (the ecosystem is stable and well-documented). Package semver versions are MEDIUM confidence due to tool access restrictions during research — always run `npm view <package> version` before pinning.*
