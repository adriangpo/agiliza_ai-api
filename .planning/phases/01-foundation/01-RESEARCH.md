# Phase 1: Foundation - Research

**Researched:** 2026-03-24
**Domain:** AdonisJS v6 scaffold, PostgreSQL RLS multi-tenancy, BullMQ/Redis, Japa testing, ESLint v9/v10 flat config, Lefthook, GitHub Actions CI
**Confidence:** HIGH (all package versions npm-verified; all critical claims cross-referenced)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 through D-06:** Feature-based folder structure. Feature code under `app/features/{name}/` with `controllers/`, `services/`, `validators/`, `policies/`, `routes.ts`, `tests/`. Shared framework code in `app/shared/`. Feature-specific tests inside `app/features/{name}/tests/`, discovered via glob `app/features/**/*.spec.ts`. Cross-cutting tests in top-level `tests/rls/` and `tests/integration/`. Migrations in `database/migrations/` with feature-prefixed filenames (`001_foundation_tenants.ts`). Per-feature API docs in `docs/features/{name}/API.md` and `docs/features/{name}/MODELS.md`.
- **D-07:** Two PostgreSQL roles: `migrator` (DDL + RLS policy owner) and `app` (DML only). No superuser in app config.
- **D-08:** `FORCE ROW LEVEL SECURITY` on all tenant-scoped tables.
- **D-09:** `tenants` table: UUID v7 primary key. All other tables: `bigint` serial IDs. Tenant FK columns: `uuid` type.
- **D-10:** `TenantMiddleware` calls `set_config('app.tenant_id', tenantId, true)` (local=true) inside `db.transaction()`. Session-scoped `SET` is forbidden.
- **D-11:** RLS policy: `USING (tenant_id = current_setting('app.tenant_id')::uuid)`. Dedicated `tests/rls/` suite verifies cross-tenant isolation.
- **D-12:** GitHub Actions CI on every push and PR to `main`.
- **D-13:** CI jobs in order: lint → test → build → security.
- **D-14:** Any failing job blocks merges.
- **D-15:** Docker Compose provides PostgreSQL (PostGIS) and Redis.
- **D-16:** Makefile is the single interface for all developer commands. All agents use `make` targets — never raw commands.
- **D-17:** Makefile targets: `up`, `down`, `test`, `test:watch`, `lint`, `lint:fix`, `migrate`, `migrate:fresh`, `dev`, `build`, `typecheck`.
- **D-18:** Separate test database (`agiliza_ai_test`). NODE_ENV=test. Per-test transaction rollback.
- **D-19:** **Lefthook** as git hook manager (not simple-git-hooks, not husky).
- **D-20:** `pre-commit`: ESLint on staged files (--max-warnings 0) + Prettier --write + tsc --noEmit.
- **D-21:** `commit-msg`: Conventional Commits format enforced.
- **D-22:** ESLint zero-warnings policy: `--max-warnings 0`. Inline disable comments only; no project-wide rule disables except test-specific relaxations.
- **D-23:** HTTP security headers middleware (Helmet-equivalent): HSTS, CSP, X-Frame-Options: DENY, X-Content-Type-Options, Referrer-Policy.
- **D-24:** CORS whitelist-only via `CORS_ALLOWED_ORIGINS`. Never `*`.
- **D-25:** Input character limits at two layers: VineJS validator AND DB column constraint simultaneously.
- **D-26:** XSS: reject-on-write via VineJS; no sanitization.
- **D-27:** Image upload: MIME magic-bytes check, extension whitelist (jpg/jpeg/png/webp), compress+resize server-side if >12MB or >1920x1080.
- **D-28:** Storage adapter designed for Cloudflare R2 (S3-compatible). Phase 1 uses local/mock adapter only.
- **D-29:** Redis-backed `RateLimit` middleware in `app/shared/middleware/`. Per-route limits.

### Claude's Discretion

- Specific ESLint rule set (TypeScript strict, import order, unicorn subset)
- Prettier configuration details (print width, semicolons, single quotes, trailing commas)
- `japa.config.ts` exact setup (plugins, reporters, file globs)
- BullMQ provider implementation (use `@adonisjs/queue` if stable and v6-ready; otherwise custom BullMQ provider with thin Adonis service wrapper)
- `.env.example` contents and validation (use `@adonisjs/env` with strict schema)
- GitHub Actions workflow file details (Node version, caching strategy, postgres service container config)
- PostGIS extension migration (create extension in a dedicated `000_extensions.ts` migration)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Project scaffolded with AdonisJS v6 API kit, TypeScript, feature-based folder structure | AdonisJS v6.21.0 scaffold command verified; feature-based tree documented in ARCHITECTURE.md |
| INFRA-02 | ESLint v9/v10 flat config + Prettier enforced; pre-commit hooks block non-conforming commits | ESLint 10.1.0 + @adonisjs/eslint-config 3.0.0 verified; Lefthook 2.1.4 on npm verified |
| INFRA-03 | PostgreSQL database configured with PostGIS extension enabled | PostGIS via Docker Compose; `CREATE EXTENSION IF NOT EXISTS postgis` in migration `000_extensions.ts` |
| INFRA-04 | Two DB roles (migrator + app); no superuser in app config | Role creation SQL pattern documented; two-role pattern in PITFALLS.md C-3 |
| INFRA-05 | FORCE ROW LEVEL SECURITY on all tenant-scoped tables | `ALTER TABLE ... FORCE ROW LEVEL SECURITY` pattern verified (stable PostgreSQL) |
| INFRA-05b | tenants table UUID v7 PK; all other tables bigint serial; tenant FK columns uuid type | uuid@13 (npm-verified) supports v7 via RFC9562; Lucid migration pattern documented |
| INFRA-06 | TenantMiddleware sets set_config with local=true inside transaction | set_config pattern and middleware code example in ARCHITECTURE.md; pitfall C-1 documented |
| INFRA-07 | Japa test runner with per-test transaction rollback; global tenant context injectable | @japa/plugin-adonisjs v3.0.2 testUtils.db().withGlobalTransaction() pattern verified |
| INFRA-08 | BullMQ + Redis for async jobs | bullmq 5.71.0 verified; @adonisjs/queue 0.6.0 requires core v7 (NOT v6); custom BullMQ provider required |
| INFRA-09 | CI pipeline: lint + type-check + full test suite on every push | GitHub Actions with postgres+postgis Docker service container; node 22.x; pattern documented |
</phase_requirements>

---

## Summary

This phase establishes the entire development foundation for a greenfield AdonisJS v6 project. The most critical research finding is a **version reality check**: AdonisJS v7 became the latest stable release on February 25, 2026, and the broader ecosystem (lucid v22, auth v10, queue v0.6) has shifted to require it. The project constraint "use the latest stable version" must be interpreted carefully — the CLAUDE.md tech stack is pinned to v6, and v6.21.0 was still actively maintained and published as recently as three weeks ago. The v6 ecosystem is complete and coherent; adopting v7 would require Node.js 24 (not available in this environment) and a rewrite of CLAUDE.md. **Use the v6 ecosystem exclusively.**

The second critical finding is about `@adonisjs/queue`: version 0.6.0 requires `@adonisjs/core ^7.0.0` and therefore **cannot be used with v6**. The fallback described in CONTEXT.md (custom BullMQ provider) is mandatory, not optional.

The third important finding is the `@adonisjs/drive` version confusion: `@adonisjs/drive v2` is actually the **v5-era** package (peer dep: `@adonisjs/application ^5`). The v6-compatible version is `@adonisjs/drive v3` (latest 3.4.1).

**Primary recommendation:** Scaffold with AdonisJS v6.21.0 API kit. Use the v6-locked ecosystem versions listed in the Standard Stack table. Implement a custom BullMQ provider (`providers/bullmq_provider.ts`). Use Lefthook (not simple-git-hooks) as locked in D-19.

---

## Project Constraints (from CLAUDE.md)

| Directive | Enforcement |
|-----------|-------------|
| AdonisJS v6 conventions — do not work around the framework | No prisma/drizzle/sequelize; no jest/vitest; no passport; no jsonwebtoken directly |
| TDD non-negotiable — tests written before implementation | Every controller, service, validator, policy gets a test file |
| RLS tenant isolation tested; any cross-tenant leak is critical failure | `tests/rls/` suite; FORCE ROW LEVEL SECURITY |
| No file does too much — services, controllers, validators, policies always separate | Feature-based folder structure; no colocation of concerns |
| ESLint + Prettier enforced from day one; CI fails on lint errors | `--max-warnings 0`; flat config (eslint.config.js); no .eslintrc.json |
| Always use latest stable versions; never pin to outdated packages | v6-latest ecosystem (v6.21.0, lucid 21.8.2, etc.); check npm before committing |
| All developer commands through `make` targets — never bypass | Makefile is law; Lefthook pre-commit also enforced |
| GSD workflow before any file-changing tools | `/gsd:execute-phase` entry point |

---

## Standard Stack

### Core (AdonisJS v6 ecosystem — all npm-verified March 2026)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@adonisjs/core` | `^6.21.0` | HTTP server, router, DI container, middleware pipeline | Framework mandate; Node.js >=20.6.0 |
| `@adonisjs/lucid` | `^21.8.2` | ORM, migrations, seeders, query builder | AdonisJS-native ORM; integrates with DI, factories, test lifecycle |
| `pg` | `^8.20.0` | PostgreSQL driver required by Lucid | Only supported driver for Lucid+PostgreSQL |
| `@vinejs/vine` | `^4.3.0` | Validation (replaces v5's @adonisjs/validator) | Bundled with v6 scaffold; lucid v21.8+ accepts ^4 |
| `@adonisjs/auth` | `^9.6.0` | Auth scaffolding, JWT guard, Lucid user provider | Official v6 package; handles token signing/verification |
| `@adonisjs/ally` | `^5.1.1` | OAuth2 social login (Google, Apple) | Official v6 package; server-side OAuth exchange |
| `@adonisjs/drive` | `^3.4.1` | Filesystem/S3/R2 storage abstraction | **v3 is v6-compat** (v2 is v5-era; v4 requires v7) |
| `@adonisjs/redis` | `^9.2.0` | Redis client (first-party AdonisJS wrapper of ioredis) | Needed by limiter; v9 is v6-compat (v10 requires v7) |
| `@adonisjs/limiter` | `^2.4.0` | Rate limiting middleware (Redis-backed) | Official v6 package; Redis-backed for multi-process |
| `bullmq` | `^5.71.0` | Job queue engine | Redis-backed, durable, retry, dedup; @adonisjs/queue requires v7 |
| `uuid` | `^13.0.0` | UUID v7 generation (RFC9562) | v7 native since uuid@10; ESM-only in v13 |
| `luxon` | `^3.4.4` | DateTime handling (lucid peer dep) | Required by Lucid; handles timezones correctly |
| `sharp` | `^0.34.5` | Image EXIF stripping, resize | Industry standard; required for RNF-02, D-27 |

### Testing

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@japa/runner` | `^3.1.4` | Core test runner | All tests — AdonisJS native, handles app lifecycle |
| `@japa/api-client` | `^2.0.4` | HTTP assertion client | Functional (endpoint) tests |
| `@japa/assert` | `^3.0.0` | Assertion library | All assertions (v3 required by api-client v2 peer dep) |
| `@japa/plugin-adonisjs` | `^3.0.2` | AdonisJS app lifecycle integration | Provides testUtils, db helpers, container access |

### Dev/CI Tooling

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `eslint` | `^10.1.0` | Linting engine | v10 is latest stable; @adonisjs/eslint-config v3 supports `^9.9.0 \|\| ^10.0.0` |
| `@adonisjs/eslint-config` | `^3.0.0` | Official AdonisJS ESLint flat config preset | Includes TypeScript, import order, AdonisJS-specific rules |
| `prettier` | `^3.8.1` | Code formatting | Version required by @adonisjs/eslint-config v3 peer dep |
| `@adonisjs/prettier-config` | `^1.4.5` | Official AdonisJS Prettier preset | Consistent with framework formatting |
| `lefthook` | `^2.1.4` | Git hook manager | D-19 locks this; Go binary on npm; fast, no Node.js dependency |
| `@commitlint/cli` | `^20.5.0` | Conventional Commits enforcement | Used by Lefthook commit-msg hook (D-21) |
| `@commitlint/config-conventional` | `^20.5.0` | Conventional Commits rule set | Extends @commitlint/cli config |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@adonisjs/drive v3` | `@flydrive/core` (underlying library) | Drive v3 wraps flydrive and integrates with AdonisJS DI — use Drive |
| Custom BullMQ provider | `@adonisjs/queue@0.6.0` | Queue requires AdonisJS v7; cannot use with v6 |
| `lefthook` | `simple-git-hooks` | CONTEXT.md D-19 locks Lefthook; simple-git-hooks is CLAUDE.md default but overridden |
| `uuid` v13 | `uuidx` or `@paralleldrive/cuid2` | uuid is the RFC standard; D-09 explicitly says UUID v7 |
| ESLint v10 | ESLint v9 | @adonisjs/eslint-config v3 supports both; use latest (v10) |

**Installation (verified commands):**

```bash
# Scaffold
npm init adonisjs@latest agiliza-ai-api -- --kit=api

# Configure first-party packages (run after scaffold)
node ace add @adonisjs/lucid    # select: PostgreSQL
node ace add @adonisjs/auth     # select: JWT guard + Lucid provider
node ace add @adonisjs/ally     # select: Google + Apple drivers
node ace add @adonisjs/drive    # installs v3 (v6-compat)
node ace add @adonisjs/redis    # for limiter
node ace add @adonisjs/limiter  # select: Redis store

# Runtime dependencies
npm install bullmq uuid luxon sharp

# Dev dependencies
npm install -D eslint@^10 @adonisjs/eslint-config @adonisjs/prettier-config prettier lefthook @commitlint/cli @commitlint/config-conventional
```

**Version verification note:** Run `npm view <package> version` before committing package.json. The versions above are npm-verified as of 2026-03-24.

---

## Architecture Patterns

### Recommended Project Structure

```
agiliza_ai-api/
├── app/
│   ├── features/
│   │   └── tenants/               # Phase 1: only tenants feature exists
│   │       ├── tenants_controller.ts
│   │       ├── tenants_service.ts
│   │       ├── validators/
│   │       ├── models/
│   │       │   └── tenant.ts
│   │       └── tests/
│   │           ├── unit/
│   │           └── functional/
│   └── shared/
│       ├── middleware/
│       │   ├── tenant_middleware.ts
│       │   └── security_headers_middleware.ts
│       ├── contracts/
│       │   └── ml_image_screener.ts   # interface stub (Phase 1)
│       ├── adapters/
│       │   └── ml_image_screener_mock.ts
│       ├── exceptions/
│       └── utils/
├── database/
│   └── migrations/
│       ├── 000_foundation_extensions.ts   # PostGIS CREATE EXTENSION
│       └── 001_foundation_tenants.ts      # tenants table, UUID v7 PK
├── providers/
│   └── bullmq_provider.ts    # custom BullMQ provider (no @adonisjs/queue)
├── tests/
│   ├── rls/
│   │   └── tenant_isolation.spec.ts
│   └── bootstrap.ts
├── config/
│   ├── database.ts
│   ├── auth.ts
│   └── limiter.ts
├── start/
│   ├── routes.ts
│   ├── kernel.ts
│   └── env.ts
├── docs/
│   └── templates/
│       ├── API.md
│       └── MODELS.md
├── .github/
│   └── workflows/
│       └── ci.yml
├── docker-compose.yml
├── docker-compose.test.yml   # or single file with profiles
├── Makefile
├── lefthook.yml
├── commitlint.config.js
├── eslint.config.js
├── .prettierrc
└── .env.example
```

### Pattern 1: TenantMiddleware with Transaction-Scoped SET

The entire request is wrapped in a DB transaction so `set_config(..., true)` (equivalent to `SET LOCAL`) persists for all queries within that request and is automatically reset when the connection returns to the pool.

```typescript
// app/shared/middleware/tenant_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import db from '@adonisjs/lucid/services/db'

export default class TenantMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    // tenantId sourced from verified JWT payload in Phase 2;
    // in Phase 1, source from X-Tenant-ID header for testing only
    const tenantId = ctx.request.header('X-Tenant-ID')

    if (!tenantId) {
      return ctx.response.unauthorized({ error: 'Missing tenant context' })
    }

    await db.transaction(async (trx) => {
      // set_config with is_local=true is transaction-scoped (safe for connection pools)
      await trx.rawQuery(
        `SELECT set_config('app.tenant_id', ?, true)`,
        [tenantId]
      )
      ctx.tenantId = tenantId
      // Expose trx on ctx so services use it — never use global db import in features
      // @ts-ignore — augment HttpContext in Phase 1 contracts
      ctx.db = trx
      await next()
    })
  }
}
```

**Why parameterised `set_config` not string interpolation:** Avoids SQL injection via a crafted `X-Tenant-ID` header. Always use the two-argument form with a parameter placeholder.

### Pattern 2: RLS Policy Setup in Migrations

```sql
-- database/migrations/001_foundation_tenants.ts
-- Run as migrator role (table owner)

CREATE TABLE tenants (
  id          UUID NOT NULL DEFAULT gen_random_uuid(),  -- replaced by app-layer UUID v7
  name        VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenants_pkey PRIMARY KEY (id)
);

-- RLS on tenants table itself is NOT needed (tenants is not tenant-scoped)
-- RLS on all tenant-scoped tables:
ALTER TABLE some_tenant_table ENABLE ROW LEVEL SECURITY;
ALTER TABLE some_tenant_table FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON some_tenant_table
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON some_tenant_table TO app;
```

### Pattern 3: Two DB Roles in Docker Compose + Migrations

```yaml
# docker-compose.yml (development + test)
services:
  postgres:
    image: postgis/postgis:17-3.5
    environment:
      POSTGRES_USER: migrator
      POSTGRES_PASSWORD: ${DB_MIGRATOR_PASSWORD}
      POSTGRES_DB: agiliza_ai
    ports:
      - "5432:5432"
    volumes:
      - ./docker/init.sql:/docker-entrypoint-initdb.d/init.sql
```

```sql
-- docker/init.sql — creates the app role with DML-only grants
CREATE ROLE app WITH LOGIN PASSWORD 'app_password';
-- Grants added after migrations create each table
```

**Lucid config requires two connection strings:**
- `DB_CONNECTION_MIGRATOR` — used only by `node ace migration:run` (triggered by `make migrate`)
- `DB_CONNECTION_APP` — used by the running application (`app` role)

### Pattern 4: Custom BullMQ Provider (MANDATORY — @adonisjs/queue requires v7)

```typescript
// providers/bullmq_provider.ts
import type { ApplicationService } from '@adonisjs/core/types'
import { Queue, Worker, type Job } from 'bullmq'
import env from '#start/env'

export default class BullMQProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    const connection = {
      host: env.get('REDIS_HOST'),
      port: env.get('REDIS_PORT'),
    }

    this.app.container.singleton('bullmq.queue', () =>
      new Queue('default', { connection })
    )

    this.app.container.singleton('bullmq.connection', () => connection)
  }

  async boot() {
    // Worker registration happens in a separate boot file
    // to avoid starting workers during HTTP requests
  }
}
```

**Job interface pattern (typed payload):**

```typescript
// app/shared/contracts/job_payloads.ts
export interface ClusterEvaluationPayload {
  reportId: number
  tenantId: string
  lat: number
  lng: number
  categoryId: number
}
```

### Pattern 5: Japa Test Setup with Per-Test Transaction Rollback

```typescript
// tests/bootstrap.ts
import { configure } from '@japa/runner'
import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import { pluginAdonisJs } from '@japa/plugin-adonisjs'
import app from '@adonisjs/core/services/app'

configure({
  files: ['app/features/**/*.spec.ts', 'tests/**/*.spec.ts'],
  plugins: [
    assert(),
    apiClient(),
    pluginAdonisJs(app),
  ],
})
```

**Per-suite transaction rollback:**

```typescript
// In each test suite
test.group('reports', (group) => {
  group.each.setup(async () => {
    // testUtils from @japa/plugin-adonisjs
    const { testUtils } = await import('@japa/plugin-adonisjs')
    // wraps each test in a transaction rolled back after
    return testUtils.db().withGlobalTransaction()
  })
})
```

**Tenant context in tests:**

```typescript
// Set RLS context in test before asserting data
await db.rawQuery(
  `SELECT set_config('app.tenant_id', ?, true)`,
  [tenantId]
)
```

### Pattern 6: UUID v7 for Tenant PKs

```typescript
// In TenantService.create() or Lucid beforeCreate hook
import { v7 as uuidv7 } from 'uuid'

// In Lucid model
class Tenant extends BaseModel {
  @beforeCreate()
  static assignUuid(tenant: Tenant) {
    if (!tenant.id) {
      tenant.id = uuidv7()
    }
  }
}
```

**Migration column definition:**
```typescript
// In migration
table.uuid('id').primary().notNullable()
// Do NOT use defaultTo(db.raw('gen_random_uuid()')) — UUID v7 is assigned in app layer
```

### Anti-Patterns to Avoid

- **Using `SET app.tenant_id` instead of `set_config(..., true)`**: Session-scoped SET leaks across pooled connections. Always use the parameterized `set_config` call inside a transaction.
- **Importing global `db` in feature files**: Features must use the transaction handle injected via `ctx.db`. Consider an ESLint rule to disallow `import db from '@adonisjs/lucid/services/db'` inside `app/features/*/`.
- **Installing `@adonisjs/queue`**: It requires `@adonisjs/core ^7`. Installing it in a v6 project will cause peer dependency conflicts and runtime failures.
- **Using `@adonisjs/drive v2`**: That is the AdonisJS v5 era version (requires `@adonisjs/application ^5`). The v6-compatible version is v3.
- **Using `new ServiceClass()` instead of `container.make(ServiceClass)`**: Bypasses DI container; injected dependencies are undefined at runtime.
- **Tenant context middleware before auth middleware in v6**: Auth must run before tenant context. In Phase 1 (no auth yet), the middleware sets tenant from header; Phase 2 switches to JWT payload.
- **Using `eslint-plugin-unicorn` directly**: `@adonisjs/eslint-config v3` already bundles unicorn rules. Adding it separately may cause duplicate/conflicting rule definitions.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID v7 generation | Custom time-based UUID function | `uuid` npm package v13 (`v7()`) | RFC9562 compliant; properly handles monotonicity and collision resistance |
| JWT token signing/verification | Direct `jsonwebtoken` | `@adonisjs/auth` v9 JWT guard | Dual JWT implementations cause key management chaos |
| Connection pooling | Manual pg Pool | Lucid's built-in Knex pool | Pool lifecycle tied to AdonisJS app lifecycle |
| Rate limit counters | Redis incr/expire manually | `@adonisjs/limiter` v2 | Handles sliding window, response headers, Redis atomicity |
| Git hook runner | Shell scripts in `.git/hooks/` | `lefthook` | Runs in parallel, supports glob patterns, npm-installable, D-19 decision |
| Conventional commit validation | Regex in commit-msg script | `@commitlint/cli` + `@commitlint/config-conventional` | Maintained, extensible, 100+ rule variants |
| RLS tenant variable | Session-level `SET` statement | `set_config('app.tenant_id', $1, true)` inside transaction | Transaction-scoped; safe across connection pools |
| Environment validation | Manual `process.env` checks | `@adonisjs/env` (`env.ts` in `start/`) | Schema-validated at boot; missing variables fail fast |
| PostGIS extension enabling | Raw psql command | Lucid migration `000_foundation_extensions.ts` with `db.rawQuery()` | Version-controlled, reproducible, part of `make migrate` |
| Test database cleanup | Manual truncation scripts | `testUtils.db().withGlobalTransaction()` | Rolls back atomically; handles test failures mid-transaction |

**Key insight:** The AdonisJS v6 ecosystem covers almost every infrastructure concern with first-party packages. The only gap is the queue system, where `@adonisjs/queue` targets v7 — requiring a thin BullMQ provider as the exception, not the rule.

---

## Common Pitfalls

### Pitfall 1: @adonisjs/queue Requires AdonisJS v7

**What goes wrong:** Developer runs `node ace add @adonisjs/queue`, gets a peer dependency warning, ignores it, and the package loads but fails at runtime with cryptic IoC container errors because `@adonisjs/queue@0.6.0` declares `"@adonisjs/core": "^7.0.0"` as a peer dependency.

**Why it happens:** The npm registry shows `@adonisjs/queue` as an official package. Training data described it as a "v6 BullMQ integration." It has since shipped its v6 support and moved to v7.

**How to avoid:** Use a custom BullMQ provider (`providers/bullmq_provider.ts`). Document this clearly in `CLAUDE.md` under "What NOT to Use."

**Warning signs:** `npm install @adonisjs/queue` prints a peer dependency conflict on `@adonisjs/core`.

### Pitfall 2: @adonisjs/drive v2 is AdonisJS v5, Not v6

**What goes wrong:** Developer installs `@adonisjs/drive@^2` expecting v6 compatibility. The package's peer dependency is `@adonisjs/application ^5.0.0` (v5 era). It installs without error but `node ace configure @adonisjs/drive` fails because the provider registration uses v5 IoC syntax.

**How to avoid:** Always install `@adonisjs/drive@^3` for v6 projects. Verify with `npm view @adonisjs/drive peerDependencies` before installing any AdonisJS package.

**Warning signs:** `node ace configure` prints "provider not found" or "unable to register provider."

### Pitfall 3: Session-Scoped SET Leaks Across Connection Pool

**What goes wrong:** Using `SET app.tenant_id = '...'` (no `LOCAL`) or `set_config('app.tenant_id', ..., false)` sets the variable at session scope. When the request completes, the Knex/Lucid connection pool reuses the connection for the next request. The next request gets the previous tenant's context until it sets its own — or until it issues a query before setting context at all, returning wrong tenant's data silently.

**Why it happens:** Copying blog examples that use `SET` without understanding connection pools.

**How to avoid:** Always use `set_config('app.tenant_id', $1, true)` (is_local=true) inside `db.transaction()`. The transaction boundary guarantees the local setting is reset when the transaction ends.

**Warning signs:** Tests pass (each test runs in a rolled-back transaction, resetting the variable automatically) but production under load shows cross-tenant data. Grep for bare `SET app.` in codebase.

### Pitfall 4: RLS Bypassed Because Runtime Role Owns the Table

**What goes wrong:** Only one DB role is created. The application runs as the same role that owns the tables (`migrator`). PostgreSQL bypasses RLS for table owners by default. All RLS policies are silently dead code.

**How to avoid:** Enforce the two-role separation from migration 001: `migrator` owns and creates tables; `app` is granted DML only and must go through RLS.

**Verification test:**
```sql
-- Connect as 'app' role, set no tenant context:
SET ROLE app;
SELECT * FROM tenants;  -- Should return 0 rows if RLS policy is active
```

### Pitfall 5: AdonisJS v6 DI — Using `new` Bypasses Container

**What goes wrong:** Developer writes `const service = new TenantService()` in tests or inside another service. The `TenantService` constructor expects injected dependencies (db, emitter) but they are undefined.

**How to avoid:** Always resolve services via the DI container: `container.make(TenantService)`. In Japa tests: `testUtils.app.container.make(TenantService)`.

**Warning signs:** `TypeError: Cannot read properties of undefined` when a service method calls `this.db.query(...)`.

### Pitfall 6: Lucid Transaction Not Propagated to Sub-Calls

**What goes wrong:** Service method runs inside `db.transaction(async (trx) => {...})` but calls a nested helper that uses the global `db` import. The nested call runs on a separate connection outside the transaction; it is NOT rolled back on error.

**How to avoid:** Every service method participating in a transaction must accept a `trx` parameter. Pattern: `MyModel.query({ client: trx }).where(...)`. Never `MyModel.query().where(...)` inside a transaction.

### Pitfall 7: False-Green RLS Tests

**What goes wrong:** Test creates tenant data, expects only that tenant's rows. Test runs inside a `withGlobalTransaction()` which has rolled back the `set_config` call. `current_setting('app.tenant_id', true)` returns NULL. RLS policy `tenant_id = NULL::uuid` evaluates to false for all rows. Test sees 0 rows, which it may not be asserting against.

**How to avoid:** In every test that needs RLS active, explicitly call `set_config` on the test's DB connection:
```typescript
await db.rawQuery(`SELECT set_config('app.tenant_id', ?, true)`, [tenant.id])
```
Also write a dedicated test that asserts zero rows when no tenant context is set (not as an error — zero rows is the correct, safe behavior).

### Pitfall 8: ESLint Plugin Version Mismatch with Flat Config

**What goes wrong:** Installing a plugin that uses the old `.eslintrc` API causes `TypeError: Cannot read property 'rules' of undefined` at lint startup.

**How to avoid:** `@adonisjs/eslint-config v3` supports ESLint `^9.9.0 || ^10.0.0` and uses flat config natively. Do not add legacy plugins without the `FlatCompat` wrapper. Check each plugin's README for flat config support before adding it.

---

## Code Examples

### RLS Contract Test (cross-tenant isolation)

```typescript
// tests/rls/tenant_isolation.spec.ts
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

const TENANT_SCOPED_TABLES: string[] = [
  // Phase 1 has no tenant-scoped tables yet beyond tenants itself
  // Add as each feature phase ships: 'reports', 'incidents', 'comments', etc.
]

for (const table of TENANT_SCOPED_TABLES) {
  test(`${table}: tenant B cannot see tenant A rows`, async ({ assert }) => {
    const tenantA = await createTenantWithRows(table)
    const tenantB = await createEmptyTenant()

    await db.rawQuery(`SELECT set_config('app.tenant_id', ?, true)`, [tenantB.id])
    const rows = await db.from(table).select('*')

    assert.lengthOf(rows, 0, `RLS leak detected on table: ${table}`)
  })
}

test('no tenant context returns zero rows (not an error)', async ({ assert }) => {
  await createTenantWithRows('reports')
  // Deliberately do NOT set tenant context
  const rows = await db.from('reports').select('*')
  assert.lengthOf(rows, 0, 'RLS should block queries with no tenant context')
})
```

### Makefile Structure

```makefile
# Makefile
.PHONY: up down test test-watch lint lint-fix migrate migrate-fresh dev build typecheck

up:
	docker compose up -d

down:
	docker compose down

test:
	NODE_ENV=test node ace test

test-watch:
	NODE_ENV=test node ace test --watch

lint:
	node ace lint --max-warnings 0

lint-fix:
	node ace lint --fix

migrate:
	node ace migration:run

migrate-fresh:
	node ace migration:fresh --seed

dev:
	node ace serve --watch

build:
	node ace build

typecheck:
	tsc --noEmit
```

### Lefthook Configuration

```yaml
# lefthook.yml
pre-commit:
  parallel: true
  commands:
    eslint:
      glob: "*.ts"
      run: npx eslint --max-warnings 0 {staged_files}
    prettier:
      glob: "*.{ts,json,yml,md}"
      run: npx prettier --write {staged_files}
    typecheck:
      run: npx tsc --noEmit

commit-msg:
  commands:
    commitlint:
      run: npx commitlint --edit {1}
```

### Docker Compose (Development)

```yaml
# docker-compose.yml
version: "3.9"
services:
  postgres:
    image: postgis/postgis:17-3.5
    environment:
      POSTGRES_USER: migrator
      POSTGRES_PASSWORD: ${DB_MIGRATOR_PASSWORD:-migrator}
      POSTGRES_DB: agiliza_ai
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/init.sql:/docker-entrypoint-initdb.d/init.sql

  redis:
    image: redis:7.4-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### GitHub Actions CI Workflow

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
          node-version: "22"
          cache: "npm"
      - run: npm ci
      - run: make lint
      - run: make typecheck

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgis/postgis:17-3.5
        env:
          POSTGRES_USER: migrator
          POSTGRES_PASSWORD: migrator
          POSTGRES_DB: agiliza_ai_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7.4-alpine
        ports: ["6379:6379"]
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"
      - run: npm ci
      - run: |
          cp .env.ci .env
          make migrate
          make test
        env:
          NODE_ENV: test
          DB_HOST: localhost
          DB_PORT: 5432
          REDIS_HOST: localhost
          REDIS_PORT: 6379

  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"
      - run: npm ci
      - run: make build

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=high
```

### Migration: PostGIS Extension (Wave 0 — must exist before any other migration)

```typescript
// database/migrations/000_foundation_extensions.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.db.rawQuery('CREATE EXTENSION IF NOT EXISTS postgis')
    await this.db.rawQuery('CREATE EXTENSION IF NOT EXISTS postgis_topology')
    await this.db.rawQuery('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
  }

  async down() {
    // Extensions are intentionally not dropped in down() — they affect the whole DB
    // Manual cleanup: DROP EXTENSION postgis CASCADE;
  }
}
```

### Migration: Tenants Table (UUID v7 PK, DB-layer role grants)

```typescript
// database/migrations/001_foundation_tenants.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('tenants', (table) => {
      table.uuid('id').primary().notNullable()  // UUID v7 assigned in app layer
      table.string('name', 255).notNullable()
      table.string('subdomain', 63).notNullable().unique()
      table.boolean('active').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    // Grant DML to app role
    await this.db.rawQuery('GRANT SELECT, INSERT, UPDATE ON tenants TO app')
    // tenants is not tenant-scoped (no RLS needed — it's the tenant registry itself)
  }

  async down() {
    this.schema.dropTable('tenants')
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `simple-git-hooks` + `lint-staged` (AdonisJS scaffold default) | `lefthook` (D-19 lock) | Phase 1 decision | Lefthook is faster (runs hooks in parallel); no Node.js runtime needed for hook execution |
| `@adonisjs/queue` (BullMQ wrapper) | Custom BullMQ provider | v0.6.0 requires core v7 | Must implement a thin provider; same BullMQ API, just no AdonisJS configure scaffold |
| `@adonisjs/drive v2` (was v6-documented) | `@adonisjs/drive v3` | v3 released for v6; v2 is v5-era | Install v3 explicitly; v2 has wrong peer dependencies |
| ESLint v9 (CLAUDE.md training data) | ESLint v10 (npm latest) | ESLint v10.0 released 2025 | @adonisjs/eslint-config v3 supports `^9.9.0 \|\| ^10.0.0`; use v10 |
| `@japa/assert v3` | `@japa/assert v4` | v4 released; still works with runner v3 | BUT: `@japa/api-client v2` peers on `@japa/assert ^2 \|\| ^3`; install v3 to satisfy peer deps |
| AdonisJS v6 (training data current) | AdonisJS v7 is now npm latest | v7 stable Feb 25, 2026 | v6 is still maintained (6.21.0 published March 2026); v7 requires Node.js 24 (not available); **use v6** |

**Deprecated/outdated:**
- `@adonisjs/validator`: v5 package. Never install. v6 uses `@vinejs/vine` bundled via scaffold.
- `@adonisjs/drive v2`: v5-era peer dependencies. Use v3 for v6 projects.
- `simple-git-hooks`: Overridden by D-19; use Lefthook.
- `husky`: CLAUDE.md forbids it; no install scripts; use Lefthook.
- `.eslintrc.json`: ESLint v8 legacy format. Always `eslint.config.js` flat config.

---

## Open Questions

1. **AdonisJS v6 vs v7 choice: should user be informed?**
   - What we know: v7 is npm `latest`; requires Node.js 24; v6.21.0 still actively maintained (published 3 weeks ago)
   - What's unclear: Whether the user wants to upgrade to v7 (and install Node 24) or explicitly stay on v6
   - Recommendation: Planner should note this in the plan. The CLAUDE.md constraint "always use latest stable versions" creates tension with the current Node.js 22 environment. The pragmatic resolution is to use v6.21.0 (latest stable v6, compatible with Node 22) and add a `## v7 Upgrade Path` note to CLAUDE.md as a follow-up task. Do NOT block Phase 1 on this.

2. **`db.transaction()` wrapping the entire request in TenantMiddleware — connection pool implications**
   - What we know: Wrapping every HTTP request in a Lucid transaction keeps the connection checked out for the entire request duration. Under high concurrency, this could cause pool exhaustion.
   - What's unclear: Whether the pool size defaults are adequate for development (they are), and whether PgBouncer will be used in production (open question from STATE.md).
   - Recommendation: Default Lucid pool (min: 2, max: 10) is fine for Phase 1. Document in `config/database.ts` with a comment explaining the RLS transaction pattern and the pool size decision.

3. **Docker Compose single file vs separate test file**
   - What we know: D-18 requires a separate test DB (`agiliza_ai_test`)
   - What's unclear: Whether to use a single `docker-compose.yml` with profiles, or a separate `docker-compose.test.yml`
   - Recommendation: Use a single file with a `test` profile for PostgreSQL (different DB name via env override). Redis instance is shared.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >=20.6.0 | AdonisJS v6.21.0 | ✓ | v22.22.0 | — |
| npm | Package management | ✓ | 10.9.4 | — |
| git | Version control, hooks | ✓ | 2.53.0 | — |
| Docker | PostgreSQL + Redis services | ✓ | 29.3.0 | — |
| docker compose | Service orchestration | ✓ | v5.1.1 | — |
| PostgreSQL client (`psql`) | DB debugging | ✓ | 18.1 | — |
| Redis (local) | Rate limiting, BullMQ | ✗ | — | Provided via `docker compose up` |
| PostgreSQL service (local) | Database | ✗ | — | Provided via `docker compose up` |
| Node.js 24 | AdonisJS v7 only | ✗ | — | Not needed — using v6 |
| `lefthook` binary | Git hooks | ✗ (system) | — | Installed as npm dev dep (`npx lefthook`) |

**Missing dependencies with no fallback:** None that block Phase 1.

**Missing dependencies with fallback:**
- Redis: `make up` starts it via Docker Compose. Tests must use `make up` before `make test`.
- PostgreSQL service: same as Redis — `make up` first.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Japa v3 (via `@japa/runner@3.1.4` + `@japa/plugin-adonisjs@3.0.2`) |
| Config file | `tests/bootstrap.ts` (Wave 0 — does not exist yet) |
| Quick run command | `make test` (NODE_ENV=test node ace test) |
| Full suite command | `make test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | Scaffold compiles with zero TypeScript errors | build | `make build && make typecheck` | ❌ Wave 0 |
| INFRA-02 | lint passes zero-warnings; pre-commit hook blocks bad commits | lint | `make lint` | ❌ Wave 0 |
| INFRA-03 | PostGIS extension enabled; `SELECT PostGIS_Version()` succeeds | functional | `node ace test --files tests/rls/tenant_isolation.spec.ts` | ❌ Wave 0 |
| INFRA-04 | App connects as `app` role, not `migrator` | functional | assert `SELECT current_user` = 'app' | ❌ Wave 0 |
| INFRA-05 | `FORCE ROW LEVEL SECURITY` blocks table owner | functional | query as migrator role without tenant context returns 0 rows | ❌ Wave 0 |
| INFRA-05b | tenants.id is UUID v7 (time-ordered); other tables use bigint | unit | assert uuidv7() format; assert table column types | ❌ Wave 0 |
| INFRA-06 | set_config is transaction-scoped; SELECT outside transaction returns null | functional | `tests/rls/tenant_isolation.spec.ts` | ❌ Wave 0 |
| INFRA-07 | Per-test transaction rollback: data inserted in test A not visible in test B | functional | two sequential tests, second asserts zero rows | ❌ Wave 0 |
| INFRA-08 | BullMQ job dispatched and processed without Redis connection error | functional | enqueue a no-op job in a test worker | ❌ Wave 0 |
| INFRA-09 | CI pipeline green on push with no feature code | CI | `.github/workflows/ci.yml` triggers on push | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `make lint && make typecheck`
- **Per wave merge:** `make test`
- **Phase gate:** Full suite green + `make build` clean before `/gsd:verify-work`

### Wave 0 Gaps

All test infrastructure must be created before any implementation can be validated:

- [ ] `tests/bootstrap.ts` — Japa configure with assert, apiClient, pluginAdonisJs plugins; file glob `['app/features/**/*.spec.ts', 'tests/**/*.spec.ts']`
- [ ] `tests/rls/tenant_isolation.spec.ts` — core RLS contract tests; starts with PostGIS version check and two-role verification
- [ ] `tests/helpers/tenant_factory.ts` — factory for creating test tenants with UUID v7
- [ ] `docker/init.sql` — creates `app` DB role with login
- [ ] `.env.ci` — CI environment variables for GitHub Actions test job
- [ ] `eslint.config.js` — flat config using `@adonisjs/eslint-config`
- [ ] `commitlint.config.js` — extends `@commitlint/config-conventional`
- [ ] `lefthook.yml` — pre-commit (eslint + prettier + typecheck) and commit-msg (commitlint) hooks

---

## Sources

### Primary (HIGH confidence)

- npm registry (verified 2026-03-24): all package versions are live-verified via `npm view <pkg> version`
- AdonisJS v6 documentation (v6-docs.adonisjs.com) — scaffold command, Node.js requirement
- PostgreSQL RLS documentation — `FORCE ROW LEVEL SECURITY`, `set_config`, `current_setting` semantics (stable feature, training data confirmed)
- `.planning/research/PITFALLS.md` — C-1 through C-8 pitfall documentation (project-specific)
- `.planning/research/ARCHITECTURE.md` — feature-based folder structure, TenantMiddleware pattern, RLS wiring

### Secondary (MEDIUM confidence)

- AdonisJS v7 release blog (adonisjs.com/blog/v7) — confirmed v7 stable Feb 25, 2026; Node.js 24 requirement
- v6-to-v7 upgrade guide (docs.adonisjs.com/v6-to-v7) — confirmed v6 package compatibility boundaries
- @adonisjs/queue GitHub README — confirmed backing engine is @boringnode/queue (not BullMQ); confirmed v7 requirement via peerDependencies

### Tertiary (LOW confidence — verified by npm peerDeps)

- @adonisjs/drive v2 = v5-era (peer dep `@adonisjs/application ^5`) — verified via `npm view @adonisjs/drive@2 peerDependencies`
- @adonisjs/drive v3 = v6-compat — verified via `npm view @adonisjs/drive@3 peerDependencies`

---

## Metadata

**Confidence breakdown:**
- Standard stack versions: HIGH — all npm-verified live on 2026-03-24
- Architecture patterns: HIGH — based on project's own ARCHITECTURE.md research document and PostgreSQL documentation (stable)
- Pitfalls: HIGH — RLS pool pitfalls are well-documented PostgreSQL behavior; v6/v7 findings are npm-verified
- Queue decision: HIGH — @adonisjs/queue peerDeps explicitly state `@adonisjs/core ^7.0.0`
- Drive version confusion: HIGH — peer deps show v2=v5-era, v3=v6-compat

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (30 days — AdonisJS ecosystem is relatively stable at the v6 patch level; v7 adoption is the only active movement)
