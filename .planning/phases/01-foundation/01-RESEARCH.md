# Phase 1: Foundation - Research

**Researched:** 2026-03-24
**Domain:** AdonisJS v7 project scaffold, PostgreSQL RLS multi-tenancy, Japa v5 test harness, BullMQ via @adonisjs/queue, ESLint v10 + Lefthook, GitHub Actions CI
**Confidence:** HIGH (all package versions verified against npm registry; AdonisJS v7 docs fetched live)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Feature code lives under `app/features/{name}/` — each feature folder contains: `controllers/`, `services/`, `validators/`, `policies/`, `routes.ts`, `tests/`, and is self-contained.
- **D-02:** Shared framework-level code lives in `app/shared/` — only base middleware, generic validators, DB provider setup, HTTP exceptions, and response helpers.
- **D-03:** Feature-specific tests live inside the feature folder at `app/features/{name}/tests/`. Japa config discovers them via glob: `app/features/**/*.spec.ts`.
- **D-04:** Cross-cutting tests (RLS contract tests, multi-feature integration tests) live in top-level `tests/` folder — `tests/rls/`, `tests/integration/`.
- **D-05:** Database migrations live in `database/migrations/` (AdonisJS default, central location). Filenames are prefixed by feature: `001_foundation_tenants.ts`, `002_auth_users.ts`, etc.
- **D-06:** Per-feature API documentation lives in `docs/features/{name}/API.md` and `docs/features/{name}/MODELS.md`. A shared template at `docs/templates/` defines the required structure. Docs are updated in the same commit as their code changes.
- **D-07:** Two PostgreSQL roles: `migrator` (DDL + RLS policy owner, used only for `node ace migration:run`) and `app` (DML only, used by the running application). No superuser credentials in `.env` for the app role.
- **D-08:** `FORCE ROW LEVEL SECURITY` applied to all tenant-scoped tables.
- **D-09:** `tenants` table uses UUID v7 as primary key. All other tables use `bigint` serial IDs. All tenant FK columns are `uuid` type.
- **D-10:** `TenantMiddleware` calls `set_config('app.tenant_id', tenantId, true)` (local=true = transaction-scoped) inside `db.transaction()`.
- **D-10a:** Authentication uses AdonisJS v7 `@adonisjs/auth` v10 opaque access tokens guard (DB-backed, instantly revocable). **JWT guard no longer exists in v7.** Tenant context is loaded from the authenticated user's DB record, not from a token payload claim.
- **D-11:** RLS policy pattern: `USING (tenant_id = current_setting('app.tenant_id', true)::uuid)`.
- **D-12:** GitHub Actions CI.
- **D-13:** CI jobs: lint → test → build → security audit.
- **D-14:** Any CI job failure blocks merges.
- **D-15:** Docker Compose provides PostgreSQL (PostGIS) and Redis.
- **D-16:** Makefile is the single developer interface. All agents must use `make` targets.
- **D-17:** Makefile targets: `make up`, `make down`, `make test`, `make test:watch`, `make lint`, `make lint:fix`, `make migrate`, `make migrate:fresh`, `make dev`, `make build`, `make typecheck`.
- **D-18:** Separate test database. `NODE_ENV=test` → different DB name. Japa wraps each test in a transaction that rolls back.
- **D-19:** **Lefthook** as the git hook manager (fast binary, no Node.js runtime dependency).
- **D-20:** `pre-commit` hook: ESLint on staged files + Prettier --write + tsc --noEmit.
- **D-21:** `commit-msg` hook: Conventional Commits format.
- **D-22:** ESLint zero-warnings policy — `--max-warnings 0` always.
- **D-23:** HTTP security headers middleware (HSTS, CSP, X-Frame-Options, etc.) from day one.
- **D-24:** CORS whitelist-only via `CORS_ALLOWED_ORIGINS`. Never `*`.
- **D-25:** Input character limits enforced at VineJS validator + DB column simultaneously.
- **D-26:** XSS rejection on write — VineJS rejects HTML/script content.
- **D-27:** Image upload: MIME magic bytes check, extension whitelist, compress/resize if > 12MB or > 1920×1080.
- **D-28:** Cloudflare R2 production storage. Local/mock adapter in Phase 1.
- **D-29:** Rate limiting middleware in `app/shared/middleware/`. Redis-backed. Per-feature limits.
- **D-30:** All feature docs MUST include Mermaid diagrams (ER, sequence, state diagrams) in fenced ` ```mermaid ``` ` blocks.

### Claude's Discretion

- Specific ESLint rule set (TypeScript strict, import order, unicorn subset, etc.)
- Prettier configuration details
- `japa.config.ts` exact setup (plugins, reporters, file globs)
- BullMQ provider implementation (use `@adonisjs/queue` if stable and v7-ready; otherwise custom BullMQ provider)
- `.env.example` contents and validation schema
- GitHub Actions workflow file details (Node version, caching strategy, postgres service container config)
- PostGIS extension migration

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Project scaffolded with AdonisJS v7 API kit (Node.js 24), TypeScript, feature-based folder structure | Section: Standard Stack, Architecture Patterns |
| INFRA-02 | ESLint v10 flat config + Prettier enforced; Lefthook pre-commit hooks block non-conforming commits | Section: Standard Stack (Tooling), Code Examples |
| INFRA-03 | PostgreSQL database configured with PostGIS extension enabled | Section: Standard Stack (Database), Architecture Patterns (RLS) |
| INFRA-04 | Two DB roles: `migrator` (DDL) and `app` (DML, RLS-restricted); no superuser in app config | Section: Architecture Patterns (RLS Setup), Don't Hand-Roll |
| INFRA-05 | `FORCE ROW LEVEL SECURITY` applied to all tenant-scoped tables | Section: Architecture Patterns (RLS), Code Examples |
| INFRA-05b | Tenants table uses UUID v7 PK; all other tables use bigint serial; tenant FK columns are uuid | Section: Architecture Patterns (ID Strategy), Code Examples |
| INFRA-06 | `TenantMiddleware` sets `set_config('app.tenant_id', ..., true)` inside a transaction | Section: Architecture Patterns (TenantMiddleware), Code Examples |
| INFRA-07 | Japa test runner with DB transaction rollback per test; global tenant context injectable | Section: Architecture Patterns (Japa Setup), Code Examples |
| INFRA-08 | BullMQ + Redis configured for async background jobs | Section: Standard Stack (@adonisjs/queue), Code Examples |
| INFRA-09 | CI pipeline runs lint, type-check, full test suite on every push | Section: Architecture Patterns (GitHub Actions), Code Examples |

</phase_requirements>

---

## Summary

AdonisJS v7 (released 2025, requires Node.js 24+) is a significant but targeted evolution from v6. The most impactful change for this project is that **`ts-node` is replaced by `@poppinss/ts-exec`** and the **JWT guard no longer exists** — `@adonisjs/auth` v10 ships only opaque access tokens (DB-backed hashes). Both of these decisions are already locked in CONTEXT.md (D-10a). The scaffold command changed from `npm init adonisjs` to `npm create adonisjs`. The API starter kit is now standalone (NOT a monorepo — the monorepo variant is a separate Turborepo kit) and ships with Lucid ORM, auth, VineJS, CORS, ESLint, and Prettier pre-configured but **auth and Lucid unconfigured until you run `node ace add`**.

The `@adonisjs/queue` v0.6.0 package is confirmed working with `@adonisjs/core ^7.0.0` (verified via npm peerDependencies). It is built on `@boringnode/queue` (not BullMQ directly) and supports a Redis driver, a Database driver, and a Sync driver for tests. This is **not** a BullMQ wrapper — it is a different queue engine. If the locked decision requires BullMQ semantics specifically (job deduplication, advisory locks, dead-letter queues), a custom BullMQ provider may be needed. This is flagged as an open question.

Lucid v22 introduces **auto-generated schema classes** from migrations: after running `node ace migration:run`, Lucid queries the DB and generates `database/schema.ts` with typed column definitions. Models extend these generated classes instead of manually decorating every column. This changes how models are written but does not affect migration authoring. PostGIS custom types (`geography`, `geometry`) map to `unknown` in the generated schema and require `schema_rules.ts` overrides.

**Primary recommendation:** Scaffold with `npm create adonisjs@latest agiliza_ai-api -- --kit=api`, then use `node ace add` for each first-party package. Use `lefthook.yml` (not `package.json` hooks) for git hooks. Accept @adonisjs/queue for background jobs but test whether its Redis driver provides the idempotency guarantees required for cluster detection (RNF-04) before Phase 4.

---

## Standard Stack

### Core (verified 2026-03-24)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@adonisjs/core` | 7.1.1 | HTTP server, router, DI container, middleware pipeline | Framework core, locked |
| `@adonisjs/lucid` | 22.2.0 | ORM, migrations, schema generation, query builder | Official AdonisJS ORM, locked |
| `pg` | 8.20.0 | PostgreSQL driver for Lucid | Required by Lucid PostgreSQL config |
| `@adonisjs/auth` | 10.0.0 | Opaque access tokens guard, user provider | Locked (D-10a) — no JWT |
| `@vinejs/vine` | 4.3.0 | Request validation (replaces v5 validator) | Ships with v7 scaffold |
| `@adonisjs/cors` | ships with scaffold | CORS middleware | Part of API starter kit |

### Auth Tokens Table

The `@adonisjs/auth` v10 access tokens guard requires an `auth_access_tokens` table:

| Column | Type | Purpose |
|--------|------|---------|
| `id` | increments | Primary key |
| `tokenable_id` | integer (or bigint) | FK → users |
| `type` | string | Token type (e.g., `auth_token`) |
| `name` | string nullable | Human-readable label |
| `hash` | string | Hashed token stored server-side |
| `abilities` | text | JSON array |
| `created_at` | timestamp | — |
| `updated_at` | timestamp | — |
| `last_used_at` | timestamp nullable | — |
| `expires_at` | timestamp nullable | Optional expiry |

Tokens are NOT JWTs. No refresh tokens needed — opaque tokens are simply deleted from the DB to revoke. Re-authentication or calling `User.accessTokens.create()` again issues a new token.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@adonisjs/queue` | 0.6.0 | Background job processing (Redis driver) | All async jobs (cluster detection, notifications, ML screening) |
| `@adonisjs/redis` | 10.0.0 | Redis client (ioredis wrapper) | Rate limiting store, queue connection, token blocklist (future) |
| `@adonisjs/limiter` | 3.0.1 | Rate limiting middleware (Redis-backed) | Per-route rate limits |
| `@adonisjs/drive` | 4.0.0 | File storage abstraction (local/S3/R2) | Image uploads — local adapter in Phase 1 |
| `@adonisjs/ally` | 6.0.0 | OAuth2 social login (Phase 2) | Google + Apple OAuth |
| `@japa/runner` | 5.3.0 | Test runner | All tests |
| `@japa/api-client` | 3.2.1 | HTTP assertion client | Functional/endpoint tests |
| `@japa/plugin-adonisjs` | 5.2.0 | AdonisJS app lifecycle integration for Japa | Required for testUtils |
| `@japa/assert` | 4.2.0 | Assertion library | All test assertions |
| `bullmq` | 5.71.0 | BullMQ (only if @adonisjs/queue Redis driver insufficient — see open questions) | Cluster detection idempotency |
| `geolib` | 3.3.4 | Haversine distance (JS-side GPS validation) | Submission GPS accuracy check |
| `sharp` | 0.34.5 | Image processing (EXIF strip, resize) | Phase 3+ image uploads |
| `eslint` | 10.1.0 | Linting engine | Code quality |
| `@adonisjs/eslint-config` | 3.0.0 | Official AdonisJS ESLint preset (flat config) | Includes TS rules + AdonisJS patterns |
| `prettier` | 3.x | Code formatting | Formatting |
| `@adonisjs/prettier-config` | 1.4.5 | Official AdonisJS Prettier preset | Consistent formatting |
| `lefthook` | 2.1.4 | Git hooks manager | Pre-commit lint/format, commit-msg validation |
| `@commitlint/cli` | 20.5.0 | Commit message linting | Conventional Commits enforcement |
| `@commitlint/config-conventional` | 20.5.0 | Commitlint rule set | Supports feat/fix/chore/docs/test/refactor/perf/ci |
| `@poppinss/ts-exec` | 1.4.4 | JIT TypeScript compiler (replaces ts-node) | Development server + ace commands |
| `knex-postgis` | 0.14.x | PostGIS query helpers for Knex | Optional; raw SQL is always acceptable |

### What NOT to Use (v7-specific additions)

| Package / Pattern | Why Not |
|---|---|
| `ts-node` / `ts-node-maintained` | Replaced by `@poppinss/ts-exec` in v7. Do not install. |
| `@adonisjs/jwt` | JWT guard removed in v7 auth. Only opaque tokens exist. |
| `jsonwebtoken` | No JWT in v7 auth; using it creates a dual-auth implementation. |
| `simple-git-hooks` + `lint-staged` | Replaced by Lefthook (D-19). Do not use both. |
| `husky` | Same reason as simple-git-hooks. |
| `.eslintrc.json` | ESLint v9/v10 flat config only. Use `eslint.config.ts`. |
| `eslint-config-airbnb` | Conflicts with `@adonisjs/eslint-config`. |
| `jest` / `vitest` | Use Japa — it handles AdonisJS app lifecycle. |
| `prisma` / `drizzle` / `sequelize` | Use Lucid — the official AdonisJS ORM. |
| In-memory rate limiting | Redis-backed only — multi-process safety. |
| Monorepo scaffold | The Turborepo + Tuyau kit is for SPA frontends. API-only projects use the standalone `--kit=api`. |

### Verified Package Installation

```bash
# Scaffold (creates standalone API project — NOT monorepo)
npm create adonisjs@latest agiliza_ai-api -- --kit=api
cd agiliza_ai-api
node --version  # must be v24+

# Configure first-party packages (installs + wires providers + creates config files)
node ace add @adonisjs/lucid       # select PostgreSQL
node ace add @adonisjs/auth        # select access_tokens guard + Lucid user provider
node ace add @adonisjs/redis
node ace add @adonisjs/limiter     # select Redis store
node ace add @adonisjs/drive       # select local disk for Phase 1
node ace add @adonisjs/queue

# Supporting packages
npm install pg geolib
npm install -D lefthook @commitlint/cli @commitlint/config-conventional

# Phase 3+ (not Phase 1)
npm install sharp knex-postgis
node ace add @adonisjs/ally
```

---

## Architecture Patterns

### Recommended Project Structure

The default AdonisJS v7 API kit structure, extended with the locked feature-based convention (D-01 through D-06):

```
agiliza_ai-api/
├── app/
│   ├── features/                     # Feature vertical slices (D-01)
│   │   ├── auth/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── validators/
│   │   │   ├── policies/
│   │   │   ├── routes.ts
│   │   │   └── tests/
│   │   │       ├── unit/
│   │   │       └── functional/
│   │   └── [future features...]
│   ├── shared/                       # Framework-level cross-cutting (D-02)
│   │   ├── middleware/
│   │   │   ├── tenant_middleware.ts
│   │   │   └── rate_limit_middleware.ts
│   │   ├── adapters/                 # ML screener, storage interface
│   │   ├── contracts/                # TypeScript interfaces
│   │   ├── exceptions/
│   │   └── utils/
│   └── models/                       # Lucid models (framework default location)
├── bin/
│   ├── server.ts
│   ├── console.ts
│   └── test.ts
├── config/
│   ├── app.ts
│   ├── auth.ts
│   ├── database.ts
│   ├── queue.ts
│   ├── redis.ts
│   ├── drive.ts
│   └── limiter.ts
├── database/
│   ├── migrations/                   # Central (D-05), prefixed by feature
│   │   └── 000_foundation_extensions.ts  # PostGIS CREATE EXTENSION
│   └── schema.ts                     # Auto-generated by Lucid — never edit manually
├── start/
│   ├── routes.ts                     # Imports routes from each feature
│   ├── kernel.ts                     # Middleware registration
│   ├── env.ts                        # Environment variable schema
│   └── limiter.ts                    # Rate limit configurations
├── tests/
│   ├── rls/                          # Cross-tenant RLS contract tests (D-04)
│   └── integration/                  # Multi-feature integration tests (D-04)
├── docs/
│   ├── templates/
│   │   ├── API.md                    # Template with Mermaid skeleton (D-30)
│   │   └── MODELS.md                 # Template with ER diagram skeleton (D-30)
│   └── features/
├── adonisrc.ts
├── tsconfig.json
├── eslint.config.ts
├── lefthook.yml
├── .commitlintrc.json
├── docker-compose.yml
├── Makefile
└── .env.example
```

### Pattern 1: AdonisJS v7 adonisrc.ts

```typescript
// adonisrc.ts
import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  preloads: [
    () => import('./start/routes.js'),
    () => import('./start/kernel.js'),
  ],
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/hash_provider'),
    () => import('@adonisjs/cors/cors_provider'),
    () => import('@vinejs/vine/vine_provider'),
    () => import('@adonisjs/lucid/database_provider'),
    () => import('@adonisjs/auth/auth_provider'),
    () => import('@adonisjs/redis/redis_provider'),
    () => import('@adonisjs/limiter/limiter_provider'),
    () => import('@adonisjs/drive/drive_provider'),
    () => import('@adonisjs/queue/queue_provider'),
  ],
  commands: [
    () => import('@adonisjs/core/commands'),
    () => import('@adonisjs/lucid/commands'),
    () => import('@adonisjs/queue/commands'),
  ],
  tests: {
    suites: [
      {
        name: 'unit',
        files: ['app/features/**/tests/unit/**/*.spec.ts'],
        timeout: 2000,
      },
      {
        name: 'functional',
        files: ['app/features/**/tests/functional/**/*.spec.ts'],
        timeout: 30_000,
      },
      {
        name: 'rls',
        files: ['tests/rls/**/*.spec.ts'],
        timeout: 30_000,
      },
      {
        name: 'integration',
        files: ['tests/integration/**/*.spec.ts'],
        timeout: 30_000,
      },
    ],
  },
})
```

### Pattern 2: Middleware Registration in start/kernel.ts (v7)

In v7 there are three middleware stacks — server, router, and named:

```typescript
// start/kernel.ts
import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

// Server middleware — runs for ALL requests including 404s
server.use([
  () => import('@adonisjs/cors/cors_middleware'),
  () => import('#shared/middleware/security_headers_middleware'),
])

// Router middleware — runs only when a route matches
router.use([
  () => import('@adonisjs/core/bodyparser_middleware'),
])

// Named middleware — applied explicitly per route or group
export const middleware = router.named({
  auth: () => import('@adonisjs/auth/auth_middleware'),
  tenant: () => import('#shared/middleware/tenant_middleware'),
  throttle: () => import('@adonisjs/limiter/throttle_middleware'),
})
```

**Critical middleware ordering in routes:** auth MUST be applied before tenant, because TenantMiddleware loads tenant from the authenticated user record.

```typescript
// Route group pattern for protected routes
router.group(() => {
  // feature routes go here
})
  .use(middleware.auth({ guards: ['api'] }))
  .use(middleware.tenant())
```

### Pattern 3: TenantMiddleware with SET LOCAL (transaction-scoped)

```typescript
// app/shared/middleware/tenant_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import db from '@adonisjs/lucid/services/db'

export default class TenantMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    // tenant is resolved from ctx.auth.user — loaded by auth middleware first
    const user = ctx.auth.user!
    const tenantId = user.tenantId

    await db.transaction(async (trx) => {
      // set_config with is_local=true is equivalent to SET LOCAL
      // Safe with connection pooling; resets on transaction end
      await trx.rawQuery(
        `SELECT set_config('app.tenant_id', ?, true)`,
        [tenantId]
      )
      ctx.tenantId = tenantId
      ctx.db = trx
      await next()
    })
  }
}
```

### Pattern 4: PostgreSQL RLS Setup

Two-role strategy. The `migrator` role owns the tables (and is subject to FORCE RLS via explicit BYPASSRLS = false). The `app` role has only DML grants.

```sql
-- Executed as superuser (postgres) during initial DB setup
-- Create roles
CREATE ROLE migrator LOGIN PASSWORD 'migrator_password' NOINHERIT;
CREATE ROLE app LOGIN PASSWORD 'app_password' NOINHERIT;

-- migrator owns the tables but is ALSO subject to RLS (FORCE ROW LEVEL SECURITY ensures this)
-- app role is never the table owner
```

```typescript
// database/migrations/000_foundation_extensions.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.db.rawQuery('CREATE EXTENSION IF NOT EXISTS postgis')
    await this.db.rawQuery('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
  }
  async down() {
    // Extensions are never dropped in production
  }
}
```

```typescript
// database/migrations/001_foundation_tenants.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('tenants', (table) => {
      // UUID v7 PK (D-09) — use gen_random_uuid() as fallback;
      // real UUID v7 generation requires pg extension or application layer
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()'))
      table.string('name', 255).notNullable()
      table.string('slug', 100).notNullable().unique()
      table.timestamps(true, true)
    })

    // RLS — tenants table itself is NOT tenant-scoped (public registry)
    // All OTHER tenant-scoped tables follow this pattern:
    // await this.db.rawQuery(`
    //   ALTER TABLE some_table ENABLE ROW LEVEL SECURITY;
    //   ALTER TABLE some_table FORCE ROW LEVEL SECURITY;
    //   CREATE POLICY tenant_isolation ON some_table
    //     USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    //     WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
    //   GRANT SELECT, INSERT, UPDATE, DELETE ON some_table TO app;
    // `)
  }
}
```

**UUID v7 note:** PostgreSQL does not ship with a native UUID v7 generator. Options:
1. Generate UUID v7 in the application layer using `uuidv7` npm package and pass it explicitly on insert.
2. Install the `pg_uuidv7` PostgreSQL extension (available in many hosted Postgres setups).
3. Use a raw SQL function that constructs UUID v7 from timestamp bits (implementable without extension).

The simplest approach: generate UUID v7 application-side using `uuidv7` package.

```bash
npm install uuidv7
```

### Pattern 5: Japa v5 Test Setup with Per-Test Transaction Rollback

```typescript
// tests/bootstrap.ts
import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import testUtils from '@adonisjs/core/services/test_utils'
import type { Config } from '@japa/runner/types'

export const plugins: Config['plugins'] = [
  assert(),
  apiClient(),
  pluginAdonisJS(testUtils),
]

export const runnerHooks: Config['runnerHooks'] = {
  setup: [
    () => testUtils.httpServer().start(),
    () => testUtils.db().migrate(),
  ],
  teardown: [
    () => testUtils.httpServer().close(),
  ],
}
```

Per-test rollback in each test group:

```typescript
// Pattern for any test group needing DB isolation
test.group('Feature name', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
})
```

**Important for RLS tests:** Inside a global transaction, explicitly set the tenant context before querying:

```typescript
// Correct: set tenant context inside the test transaction
test('tenant A cannot see tenant B data', async ({ assert }) => {
  const trx = db.connection() // uses the global transaction
  await trx.rawQuery(`SELECT set_config('app.tenant_id', ?, true)`, [tenantB.id])
  const rows = await trx.from('some_table').select('*')
  assert.lengthOf(rows, 0, 'RLS leak detected')
})
```

### Pattern 6: @adonisjs/queue v0.6.0 Job Definition

**Important:** `@adonisjs/queue` uses `@boringnode/queue` internally — it is NOT a BullMQ wrapper. The API is simpler and the Redis driver uses standard queue semantics. See Open Questions for BullMQ vs @adonisjs/queue trade-offs.

```typescript
// app/features/clustering/jobs/cluster_evaluation_job.ts
import { Job } from '@adonisjs/queue'

interface ClusterEvaluationPayload {
  reportId: number
  tenantId: string
  lat: number
  lng: number
  categoryId: number
}

export default class ClusterEvaluationJob extends Job<ClusterEvaluationPayload> {
  static options = {
    queue: 'default',
    maxRetries: 3,
  }

  async execute() {
    const { reportId, tenantId, lat, lng, categoryId } = this.payload
    // business logic via ClusteringService
  }

  async failed(error: Error) {
    // dead letter handling
  }
}
```

Dispatch from service:

```typescript
await ClusterEvaluationJob.dispatch({ reportId, tenantId, lat, lng, categoryId })
```

Test assertion without processing:

```typescript
const fake = QueueManager.fake()
await reportsService.create(payload)
fake.assertPushed(ClusterEvaluationJob)
QueueManager.restore()
```

### Pattern 7: config/queue.ts (Redis driver)

```typescript
// config/queue.ts
import { defineConfig, drivers } from '@adonisjs/queue'

export default defineConfig({
  defaultQueue: 'default',
  queue: {
    default: {},
  },
  driver: drivers.redis({ connectionName: 'main' }),
})
```

### Pattern 8: Lefthook Configuration

```yaml
# lefthook.yml
pre-commit:
  parallel: false
  commands:
    lint:
      glob: '*.ts'
      run: npx eslint --max-warnings 0 {staged_files}
    format:
      glob: '*.ts'
      run: npx prettier --write {staged_files} && git add {staged_files}
    typecheck:
      run: npx tsc --noEmit

commit-msg:
  commands:
    commitlint:
      run: npx commitlint --edit {1}
```

```json
// .commitlintrc.json
{
  "extends": ["@commitlint/config-conventional"],
  "rules": {
    "type-enum": [2, "always", ["feat", "fix", "chore", "docs", "test", "refactor", "perf", "ci"]]
  }
}
```

Install Lefthook (binary, no Node.js runtime required at hook execution time):

```bash
npm install -D lefthook
npx lefthook install    # registers hooks in .git/hooks/
```

### Pattern 9: ESLint v10 Flat Config

```typescript
// eslint.config.ts
import adonisjs from '@adonisjs/eslint-config'

export default adonisjs()
```

`@adonisjs/eslint-config` v3 includes:
- `@typescript-eslint` rules (TypeScript strict)
- Import ordering rules
- AdonisJS-specific patterns
- Already compatible with ESLint v10 flat config

For zero-warnings enforcement in npm scripts:

```json
{
  "scripts": {
    "lint": "eslint . --max-warnings 0",
    "lint:fix": "eslint . --fix --max-warnings 0"
  }
}
```

### Pattern 10: GitHub Actions CI with PostGIS

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
      - run: npm ci
      - run: make lint
      - run: make typecheck

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgis/postgis:17-3.5
        env:
          POSTGRES_USER: agiliza_ai
          POSTGRES_PASSWORD: password
          POSTGRES_DB: agiliza_ai_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
      - run: npm ci
      - run: make migrate
        env:
          NODE_ENV: test
          DB_CONNECTION: pg
          PG_HOST: localhost
          PG_PORT: 5432
          PG_USER: agiliza_ai
          PG_PASSWORD: password
          PG_DB_NAME: agiliza_ai_test
      - run: make test
        env:
          NODE_ENV: test

  build:
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
      - run: npm ci
      - run: make build

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
      - run: npm ci
      - run: npm audit --audit-level=high
```

**Docker image for PostGIS in CI:** Use `postgis/postgis:17-3.5` (PostgreSQL 17 with PostGIS 3.5). This is the official PostGIS Docker image and works as a GitHub Actions service container.

### Pattern 11: Docker Compose (local dev)

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgis/postgis:17-3.5
    environment:
      POSTGRES_USER: agiliza_ai
      POSTGRES_PASSWORD: password
      POSTGRES_DB: agiliza_ai
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

### Pattern 12: Lucid Schema Classes (v22 — new in v7)

After running `node ace migration:run`, Lucid auto-generates `database/schema.ts`. Models extend these classes:

```typescript
// database/schema.ts (auto-generated — never edit this file)
// Generated after running: node ace migration:run
export class TenantsSchema extends BaseModel {
  @column({ isPrimary: true })
  declare id: string  // uuid

  @column()
  declare name: string

  @column()
  declare slug: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
```

```typescript
// app/models/tenant.ts (your model — extends generated schema)
import { TenantsSchema } from '#database/schema'

export default class Tenant extends TenantsSchema {
  // Add relationships, hooks, and computed properties here
  // No need to redeclare @column() for standard columns
}
```

**For PostGIS columns:** The `geography` and `geometry` types are unknown to Lucid's schema generator. Add overrides in `database/schema_rules.ts`:

```typescript
// database/schema_rules.ts
export default {
  tables: {
    reports: {
      location: { as: 'string' }  // Store as WKT string; raw queries handle the rest
    }
  }
}
```

### Anti-Patterns to Avoid

- **Using `npm init adonisjs`:** The v7 scaffold command is `npm create adonisjs`. The old command may install v6.
- **Using `node ace configure` instead of `node ace add`:** In v7, `node ace add` does both `npm install` and `configure` in one step. Use `node ace add` for all first-party packages.
- **Using `ts-node` in Makefile dev scripts:** AdonisJS v7 uses `@poppinss/ts-exec` via `bin/server.ts`. The dev command remains `node ace serve --watch` but uses ts-exec internally.
- **Using `getDirname()` / `getFilename()` helpers:** Removed in v7. Use `import.meta.dirname` and `import.meta.filename`.
- **Using `router.makeUrl()`:** Replaced by `urlFor()` in v7.
- **Using `Request` / `Response` type imports:** Renamed to `HttpRequest` / `HttpResponse` in v7.
- **Editing `database/schema.ts`:** This file is auto-regenerated on every migration run. Customizations belong in model files or `database/schema_rules.ts`.
- **Global `db` import inside feature services:** Services must use the `trx` handle from TenantMiddleware (passed via ctx or as a parameter) — not the global `db` import. The global `db` bypasses RLS.
- **`set_config` without `is_local=true`:** Session-scoped `SET` leaks across pooled connections. Always use `set_config('app.tenant_id', id, true)` (third param = local/transaction-scoped).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Background jobs with Redis | Custom queue provider | `@adonisjs/queue` v0.6.0 | Typed jobs, fake adapter for tests, scheduler, retry strategies |
| Rate limiting | Custom Redis counter middleware | `@adonisjs/limiter` v3 | Atomic increments, sliding window, per-route config |
| File storage abstraction | Custom S3/local switch | `@adonisjs/drive` v4 | Supports local, S3, R2, GCS; fake adapter for tests |
| Git hook scripts | Shell scripts in `.git/hooks/` | Lefthook with `lefthook.yml` | Binary install, no Node.js dep, supports parallel/serial hooks |
| Commit message validation | Regex in shell script | `@commitlint/cli` + `@commitlint/config-conventional` | Standard ruleset, configurable, Lefthook-native |
| Opaque token management | Custom token table + hash logic | `@adonisjs/auth` v10 `DbAccessTokensProvider` | Hash storage, abilities, expiry, revocation — all built-in |
| PostgreSQL connection | Raw `pg` Pool | Lucid ORM (`@adonisjs/lucid`) | Migrations, schema generation, transactions, factories, seeders |
| Environment validation | Manual `process.env` checks | `start/env.ts` with `Env.schema` | Type-safe, early validation, fails fast at startup |
| CORS handling | Custom headers middleware | `@adonisjs/cors` (ships with API kit) | Configurable, tested, integrates with AdonisJS HTTP context |

**Key insight:** AdonisJS v7 has official packages for almost every cross-cutting concern. The ecosystem cost of hand-rolling (maintenance, edge cases, test coverage) is never worth it when an official package exists.

---

## Common Pitfalls

### Pitfall 1: Wrong Scaffold Command / Wrong Kit (v7-specific)

**What goes wrong:** Using `npm init adonisjs@latest -- --kit=api` (v6 syntax) or using the Turborepo monorepo kit when you want a standalone API. The monorepo kit adds Turborepo + Tuyau type sharing — appropriate for full-stack apps, overkill for an API-only project.
**Why it happens:** Blog posts and v6 docs still use the old `npm init` syntax.
**How to avoid:** Use `npm create adonisjs@latest <project-name> -- --kit=api`. The `api` kit is now a standalone project, not a monorepo.
**Warning signs:** `turbo.json` present in project root, or an `apps/` directory — these indicate the wrong kit was used.

### Pitfall 2: Editing auto-generated `database/schema.ts` (v7-specific)

**What goes wrong:** In v7, `database/schema.ts` is regenerated every time migrations run. Any manual edits are overwritten silently.
**Why it happens:** Developers unfamiliar with the new schema generation feature add `@column()` decorators directly in schema.ts.
**How to avoid:** Customizations go in `database/schema_rules.ts` (type overrides) or in your model class files (relationships, hooks, computed properties).
**Warning signs:** Seeing `@column()` decorators added manually in `database/schema.ts`.

### Pitfall 3: Session-Scoped SET vs Transaction-Scoped set_config (CRITICAL)

**What goes wrong:** Using `SET app.tenant_id = '...'` (session-scoped) instead of `set_config('app.tenant_id', id, true)` (transaction-scoped). In a connection pool, session-scoped SET persists after the request ends and leaks tenant context to the next request on that connection.
**Why it happens:** Copy-paste from non-pooled examples.
**How to avoid:** Always use `set_config('app.tenant_id', id, true)` inside `db.transaction()`. The `true` parameter is `is_local = true` which is transaction-scoped.
**Warning signs:** Grep for bare `SET app.` in middleware or migrations.

### Pitfall 4: RLS Bypass by Table Owner

**What goes wrong:** The `migrator` role owns the tables. By default, PostgreSQL bypasses RLS for table owners. Unless `FORCE ROW LEVEL SECURITY` is set, the `migrator` role ignores all policies.
**How to avoid:** Every tenant-scoped table must have `ALTER TABLE x FORCE ROW LEVEL SECURITY;` in its migration. Test by connecting as `migrator` without setting tenant context and asserting zero rows (not all rows).

### Pitfall 5: JWT Assumptions in Auth Code

**What goes wrong:** Code written assuming JWT (tenant in token payload, stateless token verification, `@adonisjs/jwt` package) fails silently because `@adonisjs/auth` v10 has no JWT guard.
**Why it happens:** Most AdonisJS tutorials pre-2025 use JWT.
**How to avoid:** Auth uses `DbAccessTokensProvider`. Tenant context is loaded from `user.tenantId` (DB record), not from token claims. Token revocation is DB delete, not blocklist.

### Pitfall 6: Test Database Pollution (Japa v5)

**What goes wrong:** DB state from one test leaks into another. Tests are order-dependent.
**How to avoid:** Use `group.each.setup(() => testUtils.db().withGlobalTransaction())` in every test group. This wraps each test in a transaction that rolls back automatically.

### Pitfall 7: Node.js Version Mismatch

**What goes wrong:** Running `npm create adonisjs` or installing `@adonisjs/core` with Node.js < 24.
**Why it happens:** `node --version` returns v22 or older in some environments.
**How to avoid:** The current machine runs v22.22.0 — this must be upgraded to v24 before scaffolding.
**Warning signs:** `engines: { node: '>=24.0.0' }` in any package.json; install fails with engine incompatibility errors.

### Pitfall 8: @adonisjs/queue vs BullMQ Feature Gap (Phase 4 concern)

**What goes wrong:** `@adonisjs/queue` v0.6.0 uses `@boringnode/queue` as its engine, not BullMQ. The BullMQ-specific features needed for cluster detection idempotency (named job deduplication, advisory-lock-aware retries) may not be available.
**Why it happens:** The queue package names suggest similarity but they are different engines.
**How to avoid:** For Phase 1, `@adonisjs/queue` is sufficient to set up the infrastructure. Before Phase 4 (clustering), verify whether the Redis driver supports job deduplication by jobId. If not, use direct BullMQ with a custom provider.
**Note:** The CONTEXT.md (Claude's Discretion) allows this trade-off decision.

---

## Code Examples

### Creating an Opaque Access Token (auth v10)

```typescript
// Source: https://docs.adonisjs.com/guides/auth/access-tokens-guard
// In auth controller — login action
const token = await User.accessTokens.create(user, ['*'], {
  name: 'Login token',
  expiresIn: '30 days',
})

return response.ok({
  token: token.value!.release(),  // returns the plaintext token — only time it's visible
})
```

### Revoking a Token

```typescript
// Source: https://docs.adonisjs.com/guides/auth/access-tokens-guard
// Logout — deletes token from DB (instant revocation)
await User.accessTokens.delete(user, auth.user!.currentAccessToken.identifier)
return response.noContent()
```

### User Model with Access Tokens Provider

```typescript
// Source: https://docs.adonisjs.com/guides/auth/access-tokens-guard
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'

export default class User extends UsersSchema {
  static accessTokens = DbAccessTokensProvider.forModel(User, {
    expiresIn: '30 days',
    prefix: 'oat_',
    table: 'auth_access_tokens',
    type: 'auth_token',
    tokenSecretLength: 40,
  })

  // Tenant association
  @column()
  declare tenantId: string
}
```

### RLS Policy Migration Snippet

```typescript
// Source: PITFALLS.md C-3 prevention pattern
await this.db.rawQuery(`
  ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
  ALTER TABLE reports FORCE ROW LEVEL SECURITY;

  CREATE POLICY tenant_isolation ON reports
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

  GRANT SELECT, INSERT, UPDATE, DELETE ON reports TO app;
`)
```

Note: `current_setting('app.tenant_id', true)` — the second argument `true` means "return NULL if not set" rather than throwing an error. The USING clause then evaluates as `NULL = NULL` which is `false`, blocking all rows when no tenant context is set. This is the correct safe default.

### Environment Variable Schema (start/env.ts)

```typescript
// Source: https://docs.adonisjs.com/guides/getting-started/environment-variables
import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  HOST: Env.schema.string({ format: 'host' }),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),

  DB_CONNECTION: Env.schema.enum(['pg'] as const),
  PG_HOST: Env.schema.string({ format: 'host' }),
  PG_PORT: Env.schema.number(),
  PG_USER: Env.schema.string(),
  PG_PASSWORD: Env.schema.string(),
  PG_DB_NAME: Env.schema.string(),

  REDIS_HOST: Env.schema.string({ format: 'host' }),
  REDIS_PORT: Env.schema.number(),
  REDIS_PASSWORD: Env.schema.string.optional(),

  QUEUE_DRIVER: Env.schema.enum(['redis', 'database', 'sync'] as const),

  CORS_ALLOWED_ORIGINS: Env.schema.string(),
})
```

---

## State of the Art

| Old Approach (v6) | Current Approach (v7) | When Changed | Impact |
|---|---|---|---|
| `npm init adonisjs@latest -- --kit=api` | `npm create adonisjs@latest <name> -- --kit=api` | v7 release 2025 | Scaffold command changed |
| `ts-node` for JIT TypeScript | `@poppinss/ts-exec` | v7 release 2025 | Must uninstall ts-node, install ts-exec |
| JWT guard (`@adonisjs/jwt`) | No JWT — opaque tokens only via `DbAccessTokensProvider` | `@adonisjs/auth` v10 | All auth code changes; no JWT payload claims |
| Manual `@column()` on every model property | Auto-generated schema classes from migrations | Lucid v22 | Models extend generated class; schema.ts never edited |
| `simple-git-hooks` + `lint-staged` | Lefthook (D-19) | Project decision | Different config format (lefthook.yml) |
| `node ace configure <pkg>` | `node ace add <pkg>` (installs + configures) | v7 / Ace v8 | Simplifies package setup |
| `getDirname()` / `getFilename()` helpers | `import.meta.dirname` / `import.meta.filename` (Node.js 24 native) | v7 release 2025 | Helpers removed from core |
| `router.makeUrl()` | `urlFor()` import | v7 release 2025 | Rename + type-safe route names |
| `Request` / `Response` type names | `HttpRequest` / `HttpResponse` | v7 release 2025 | Rename to avoid collision with fetch API globals |
| ESLint v9 | ESLint v10 | npm latest | Config format same (flat config), updated rules |

**Deprecated/outdated (from STACK.md — confirm retired for v7):**
- `@adonisjs/validator`: v5 package — still forbidden, v7 uses `@vinejs/vine`.
- `@adonisjs/jwt`: Removed in auth v10 — forbidden.
- `cuid()` / `isCuid()`: Removed in v7 — use UUIDs.

---

## Open Questions

1. **@adonisjs/queue Redis driver vs BullMQ for cluster detection idempotency**
   - What we know: `@adonisjs/queue` uses `@boringnode/queue` not BullMQ. It supports a Redis driver and has job retry strategies. It is confirmed compatible with `@adonisjs/core ^7.0.0`.
   - What's unclear: Whether `@boringnode/queue` Redis driver supports deduplication by a stable jobId key (required for RNF-04 idempotent cluster evaluation). BullMQ has explicit `jobId` deduplication; `@boringnode/queue` API is not fully verified.
   - Recommendation: Use `@adonisjs/queue` for Phase 1 infrastructure setup. Before Phase 4 (clustering), verify deduplication support. If insufficient, add direct BullMQ alongside `@adonisjs/queue` (not instead of it) — BullMQ can be used just for the cluster job while other jobs use `@adonisjs/queue`.
   - Priority: MEDIUM (only impacts Phase 4, not Phase 1).

2. **UUID v7 generation strategy**
   - What we know: PostgreSQL does not ship with native UUID v7 generation. `gen_random_uuid()` generates UUID v4.
   - What's unclear: Whether `pg_uuidv7` extension is available on common hosted Postgres (Supabase, Neon, Railway). The `uuidv7` npm package works application-side.
   - Recommendation: Use `uuidv7` npm package (`npm install uuidv7`) to generate UUID v7 application-side in the Tenant service layer. Explicitly pass the generated ID on insert rather than relying on a DB default. This is portable and does not require a PostgreSQL extension.

3. **Lucid schema generation and custom PostGIS column types**
   - What we know: PostGIS `geography` type maps to `unknown` in Lucid's schema generator. `schema_rules.ts` can override this.
   - What's unclear: Whether the override in `schema_rules.ts` is a string type (WKT) or if there is a better PostGIS-aware type.
   - Recommendation: Override PostGIS columns as `string` type in schema_rules.ts. All geospatial operations use raw SQL (`trx.rawQuery`) — the ORM type just needs to be non-blocking.

4. **Node.js version on developer machine**
   - What we know: The current machine runs Node.js v22.22.0. All `@adonisjs/core` v7 packages require `>=24.0.0`.
   - Recommendation: The Makefile `make dev` target or any `node ace` command will fail until Node.js 24 is installed. The plan must include a prerequisite step: install Node.js 24 (via nvm: `nvm install 24 && nvm use 24`). The Makefile should enforce this with a version check guard.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js ≥ 24 | All `@adonisjs/core` v7 packages | **PARTIAL** | v22.22.0 installed; v24 needed | Install v24 via nvm |
| npm ≥ 11 | AdonisJS v7 docs recommend | Likely present with Node 24 | — | Upgrade with Node 24 |
| Docker | `docker-compose.yml` services | ✓ | 29.3.0 | — |
| Docker Compose | `make up` | ✓ | v5.1.1 | — |
| PostgreSQL (local via Docker) | DB migrations, tests | ✓ | Available via Docker `postgis/postgis` | — |
| PostgreSQL (native) | `pg_isready` during CI | ✓ | Accepting connections on :5432 | Docker only for local dev |
| Redis (local via Docker) | Queue, rate limiter, tests | Needs Docker container | Not installed natively | `docker compose up redis` |
| `redis-cli` | Manual Redis inspection | ✗ | Not installed | Use Docker exec |
| Lefthook binary | Git hooks | ✗ | Not installed | `npm install -D lefthook && npx lefthook install` |
| `uuidv7` npm package | UUID v7 tenant PK generation | Not yet installed | — | Install via npm |

**Missing dependencies requiring action before Phase 1 can be executed:**

- **Node.js 24**: Install via `nvm install 24 && nvm use 24` before running scaffold. BLOCKING.
- **Lefthook**: Installed as npm devDependency; no native binary required.
- **Redis**: Available via Docker Compose — no local install needed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Japa 5.3.0 (`@japa/runner`) |
| Config file | `tests/bootstrap.ts` + `adonisrc.ts` test suites |
| Quick run command | `make test -- --suite=unit` |
| Full suite command | `make test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | Scaffold creates expected folder structure | smoke | `ls app/features app/shared database/migrations` | ❌ Wave 0 |
| INFRA-02 | ESLint zero-warnings on all TS files | automated | `make lint` | ❌ Wave 0 |
| INFRA-03 | PostGIS extension present and query works | functional | `make test -- --suite=rls` | ❌ Wave 0 |
| INFRA-04 | App role cannot perform DDL; migrator role owns tables | functional | `make test -- --suite=rls` | ❌ Wave 0 |
| INFRA-05 | Tenant B cannot read Tenant A data (RLS contract) | functional | `make test -- --suite=rls` | ❌ Wave 0 |
| INFRA-05b | Tenant PK is UUID v7 format; other tables use bigint serial | unit | `make test -- --suite=unit` | ❌ Wave 0 |
| INFRA-06 | TenantMiddleware sets tenant context inside transaction | functional | `make test -- --suite=functional` | ❌ Wave 0 |
| INFRA-07 | Per-test transaction rollback — no DB state bleeds across tests | functional | `make test` | ❌ Wave 0 |
| INFRA-08 | Job dispatch works; fake adapter catches dispatched jobs | unit | `make test -- --suite=unit` | ❌ Wave 0 |
| INFRA-09 | CI passes lint + type-check + test + security on push | CI | GitHub Actions (manual verify) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `make lint && make typecheck`
- **Per wave merge:** `make test`
- **Phase gate:** Full CI green (lint + test + build + security) before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/rls/tenant_isolation.spec.ts` — covers INFRA-03, INFRA-04, INFRA-05
- [ ] `tests/bootstrap.ts` — Japa runner config with `withGlobalTransaction`
- [ ] `app/features/.gitkeep` — directory existence for structure smoke test
- [ ] No Japa config exists yet — scaffold creates `bin/test.ts` and test suites in `adonisrc.ts`
- [ ] Framework install: already covered by `npm create adonisjs` scaffold

---

## Project Constraints (from CLAUDE.md)

The following CLAUDE.md directives are enforced as non-negotiable constraints. Any plan that contradicts these is invalid:

| Directive | Rule |
|-----------|------|
| Tech stack | AdonisJS v6 specified — **superseded by CONTEXT.md D-10a which mandates v7** with npm-verified versions |
| TDD | Tests written first. No feature ships without tests. Write test → watch fail → implement until pass. |
| Security | RLS tenant isolation tested exhaustively. Cross-tenant leak = CI failure. |
| Coupling | No file does too much. Separate files for controllers, services, validators, policies always. |
| Lint | ESLint + Prettier from day one. CI fails on lint errors. |
| Versions | Always use latest stable. CLAUDE.md lists v6 versions — **use the v7 npm-verified versions in the Additional Context section above.** |
| Testing framework | Japa only. Jest/Vitest forbidden. |
| ORM | Lucid only. Prisma/Drizzle/Sequelize forbidden. |
| Auth | No session-based auth. No `passport`. Use `@adonisjs/auth`. |
| Git hooks | AdonisJS scaffold uses `simple-git-hooks` — **superseded by CONTEXT.md D-19 which mandates Lefthook.** |
| ESLint format | `eslint.config.ts` flat config only. `.eslintrc.json` forbidden. |
| Rate limiting | Redis-backed only. In-memory forbidden. |
| Queues | Redis-backed BullMQ or `@adonisjs/queue`. In-process queues forbidden. |
| GSD workflow | All file changes must go through GSD commands (`/gsd:execute-phase` etc.). No direct repo edits outside GSD. |
| Makefile | All developer and agent commands use `make` targets. Never bypass with raw commands. |

**Note on CLAUDE.md version conflict:** CLAUDE.md lists v6 package versions. The CONTEXT.md discussions and the npm registry confirm v7 is the target. The CONTEXT.md decisions (D-10a, D-19, etc.) supersede CLAUDE.md where they conflict. The CLAUDE.md constraint "always use latest stable" is the governing principle — and latest stable IS v7.

---

## Sources

### Primary (HIGH confidence — fetched live 2026-03-24)

- AdonisJS v7 installation guide — https://docs.adonisjs.com/guides/getting-started/installation
- AdonisJS v7 middleware documentation — https://docs.adonisjs.com/guides/basics/middleware
- AdonisJS auth v10 access tokens guard — https://docs.adonisjs.com/guides/auth/access-tokens-guard
- AdonisJS v7 blog announcement — https://adonisjs.com/blog/v7
- AdonisJS v6-to-v7 upgrade guide — https://docs.adonisjs.com/v6-to-v7
- AdonisJS v7 testing (database) — https://docs.adonisjs.com/guides/testing/database
- AdonisJS Drive v4 — https://docs.adonisjs.com/guides/digging-deeper/drive
- AdonisJS Redis documentation — https://docs.adonisjs.com/guides/database/redis
- AdonisJS Rate Limiting — https://docs.adonisjs.com/guides/security/rate-limiting
- AdonisJS Queue v0.6.0 — https://docs.adonisjs.com/guides/digging-deeper/queues
- AdonisJS env variables — https://docs.adonisjs.com/guides/getting-started/environment-variables
- Lucid schema classes — https://lucid.adonisjs.com/docs/schema-classes
- AdonisJS API starter kit GitHub — https://github.com/adonisjs/api-starter-kit
- npm registry (all package versions verified via `npm view` commands) — https://www.npmjs.com

### Secondary (MEDIUM confidence — WebSearch verified with official source)

- AdonisJS auth v10 opaque tokens — no refresh token needed (DB token deletion is revocation) — https://github.com/orgs/adonisjs/discussions/2039
- Lefthook commitlint setup — https://lefthook.dev/examples/commitlint/
- PostGIS Docker image for GitHub Actions — https://github.com/marketplace/actions/setup-postgresql-with-postgis

### Tertiary (LOW confidence)

- @adonisjs/queue Redis driver deduplication support — not yet verified from official docs; marked as Open Question

---

## Metadata

**Confidence breakdown:**
- Standard stack versions: HIGH — verified via `npm view` against registry on 2026-03-24
- AdonisJS v7 scaffold and folder structure: HIGH — fetched from official docs and GitHub starter kit
- Auth v10 opaque tokens: HIGH — fetched from official AdonisJS docs
- @adonisjs/queue v0.6.0 Redis driver: MEDIUM — official docs fetched, but deduplication feature gap is unverified
- Japa v5 test setup: HIGH — official docs fetched; `withGlobalTransaction` pattern confirmed
- Lefthook configuration: HIGH — official lefthook.dev docs referenced
- Middleware registration pattern (v7): HIGH — official docs fetched; three-stack model confirmed
- Lucid schema classes: HIGH — official Lucid docs fetched; PostGIS type override strategy is MEDIUM

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable ecosystem; AdonisJS v7 just released, minor updates expected)
