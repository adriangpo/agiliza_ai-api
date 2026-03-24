# Architecture Patterns

**Project:** Agiliza Ai API
**Domain:** Multi-tenant municipal citizen-reporting REST API
**Researched:** 2026-03-23
**Confidence:** MEDIUM-HIGH (Adonis.js v6 conventions from training data, Aug 2025 cutoff; web fetch unavailable for live doc verification)

---

## Recommended Architecture

A layered, feature-based architecture where each feature is a vertical slice owning every file it touches. A thin horizontal layer of shared infrastructure (multi-tenancy, auth, database, events, storage) underpins all features without being coupled to any one of them.

```
HTTP Request
     │
     ▼
[ Router ]  ← routes registered per-feature
     │
     ▼
[ Tenant Middleware ]  ← sets app.tenantId on ctx, calls SET LOCAL on DB connection
     │
     ▼
[ Auth Middleware ]  ← validates JWT, hydrates ctx.auth.user
     │
     ▼
[ Rate Limit Middleware ]  ← per-user + per-IP, sliding window
     │
     ▼
[ Controller ]  ← orchestrates: validates input, delegates to service
     │
     ▼
[ Service ]  ← business logic, owns transactions, calls models + adapters
     │        └─ calls [ ML Adapter Interface ] for image screening
     │        └─ calls [ Storage Adapter ] for image uploads
     │        └─ emits [ Domain Events ] for clustering, notifications
     ▼
[ Lucid Model ]  ← data access; RLS on DB enforces tenant boundary
     │
     ▼
[ PostgreSQL + PostGIS ]
```

---

## Feature-Based Folder Structure

Each feature is a self-contained vertical slice. No feature imports from another feature's internal files — only from `shared/`.

### Top-Level Tree

```
agiliza_ai-api/
├── app/
│   ├── features/
│   │   ├── auth/
│   │   ├── reports/
│   │   ├── clustering/
│   │   ├── moderation/
│   │   ├── feed/
│   │   ├── notifications/
│   │   └── management/
│   └── shared/
│       ├── middleware/
│       ├── adapters/
│       ├── contracts/
│       ├── exceptions/
│       └── utils/
├── database/
│   ├── migrations/          ← organized by feature prefix (e.g. 001_auth_*, 002_reports_*)
│   └── seeders/
├── tests/
│   ├── unit/               ← mirrors app/features/ and app/shared/
│   ├── functional/         ← mirrors feature routes
│   └── helpers/
│       ├── tenant_factory.ts
│       └── db_cleaner.ts
├── config/
├── start/
│   ├── routes.ts            ← imports route file from each feature
│   ├── kernel.ts
│   └── events.ts
└── docs/
    └── features/            ← one markdown file per feature, auto-updated
```

### Per-Feature Tree (using `reports` as the canonical example)

```
app/features/reports/
├── reports_controller.ts        ← HTTP in/out only; no business logic
├── reports_service.ts           ← all business logic; called by controller
├── reports_policy.ts            ← authorization rules (Adonis Bouncer)
├── reports_routes.ts            ← route definitions for this feature
├── validators/
│   ├── create_report_validator.ts
│   └── update_report_validator.ts
├── models/
│   └── report.ts               ← Lucid model; belongs to this feature
└── tests/
    ├── unit/
    │   └── reports_service.spec.ts
    └── functional/
        └── reports.spec.ts
```

Every feature follows this exact shape. Adding a new feature means creating this directory tree — nothing else.

### What Each Layer Does

| File | Responsibility | What It Must NOT Do |
|------|---------------|---------------------|
| `*_controller.ts` | Parse request, call validator, call service, return response | Contain business logic or query the DB directly |
| `*_service.ts` | Own the business rules and DB transactions | Know about HTTP context (request/response) |
| `*_policy.ts` | Answer "can this user do this action?" | Perform mutations or complex queries |
| `*_routes.ts` | Register routes, attach middleware, reference controller methods | Contain logic |
| `validators/*.ts` | Define and export VineJS schema for a specific operation | Be reused across features |
| `models/*.ts` | Lucid model definition, relationships, computed properties | Contain business logic beyond accessors/serializers |

---

## Multi-Tenancy: PostgreSQL RLS

### Strategy

Row Level Security enforced at the database level is the security boundary. Middleware is the mechanism that activates it. This means even a bug in application code cannot leak cross-tenant data — the DB itself blocks the query.

**Confidence: HIGH** — This is a standard PostgreSQL pattern. The specific Adonis.js wiring is from training data.

### Database Setup

```sql
-- Enable RLS on every tenant-scoped table
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports FORCE ROW LEVEL SECURITY;   -- even table owners are subject to policy

-- Create a policy that reads the session variable
CREATE POLICY tenant_isolation ON reports
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- One superuser role that bypasses RLS for migrations
-- One application role (app_user) that is always subject to RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON reports TO app_user;
```

Every tenant-scoped table gets identical `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` + policy. A single migration helper function can generate the boilerplate.

### Middleware: Setting Tenant Context

The `TenantMiddleware` runs before any controller and sets a PostgreSQL session-local variable on the connection used for that request. Because Adonis.js / Lucid uses connection pooling (via Knex), the variable must be set as `SET LOCAL` (transaction-scoped) not `SET` (session-scoped), which requires every query to run inside a transaction.

```typescript
// app/shared/middleware/tenant_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import db from '@adonisjs/lucid/services/db'

export default class TenantMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const tenantId = ctx.request.header('X-Tenant-ID') // or from JWT payload

    if (!tenantId) {
      return ctx.response.unauthorized({ error: 'Missing tenant context' })
    }

    // Wrap the entire request in a managed transaction so SET LOCAL persists
    await db.transaction(async (trx) => {
      await trx.rawQuery(`SET LOCAL app.tenant_id = '${tenantId}'`)
      ctx.tenantId = tenantId
      ctx.db = trx          // services must use ctx.db, not the global db
      await next()
    })
  }
}
```

**Critical constraint:** Every service that writes to the DB must use the transaction handle (`ctx.db`) injected by the middleware — not the global `db` import. If a service creates a new connection, RLS is not active on that connection and the query runs without the tenant filter.

**Testing RLS:** Every functional test suite includes a cross-tenant assertion:

```typescript
// tests/functional/reports.spec.ts (pattern)
test('cannot read reports from another tenant', async ({ client }) => {
  const { tenantA, reportA } = await createTenantWithReport()
  const { tenantB, userB } = await createTenantWithUser()

  const response = await client
    .get(`/reports/${reportA.id}`)
    .header('X-Tenant-ID', tenantB.id)
    .loginAs(userB)

  response.assertStatus(404)  // not 403 — tenant B cannot even see the ID exists
})
```

---

## Geospatial Query Patterns with PostGIS + Lucid ORM

**Confidence: MEDIUM** — PostGIS SQL is HIGH confidence; Lucid ORM integration pattern is MEDIUM (verified from training data, not live docs).

Lucid ORM does not natively understand PostGIS types. All geospatial work uses raw SQL via `trx.rawQuery()` or the Knex `.raw()` escape hatch inside a query builder chain.

### Storing Geometry

```sql
-- migration
ALTER TABLE reports ADD COLUMN location GEOGRAPHY(Point, 4326);
CREATE INDEX reports_location_gist ON reports USING GIST(location);
```

The model stores coordinates as WKT on insert and receives GeoJSON on select.

### Insert Pattern

```typescript
// app/features/reports/reports_service.ts
await trx.rawQuery(
  `INSERT INTO reports (tenant_id, title, category_id, location, user_id)
   VALUES (:tenantId, :title, :categoryId, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), :userId)
   RETURNING id, title, ST_AsGeoJSON(location)::json AS location`,
  { tenantId: ctx.tenantId, title, categoryId, lng, lat, userId }
)
```

### Proximity Validation (200m GPS fence)

```typescript
// Checks that submitted GPS is within 200m of pinned location
const result = await trx.rawQuery<{ within: boolean }>(
  `SELECT ST_DWithin(
     ST_SetSRID(ST_MakePoint(:gpsLng, :gpsLat), 4326)::geography,
     ST_SetSRID(ST_MakePoint(:pinnedLng, :pinnedLat), 4326)::geography,
     200
   ) AS within`,
  { gpsLng, gpsLat, pinnedLng, pinnedLat }
)
if (!result.rows[0].within) throw new ProximityError()
```

### Cluster Detection Query

```typescript
// Find existing open reports within 50m, same category, within last 7 days
const nearby = await trx.rawQuery(
  `SELECT id FROM reports
   WHERE tenant_id = current_setting('app.tenant_id')::uuid
     AND category_id = :categoryId
     AND status = 'ABERTA'
     AND created_at >= NOW() - INTERVAL '7 days'
     AND ST_DWithin(location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, 50)`,
  { categoryId, lng, lat }
)
```

Note: RLS is active on these queries because they run on the same `trx` injected by `TenantMiddleware`.

---

## Clustering Logic Architecture

### Decision: Background Job (via Adonis.js Queue / BullMQ)

**Rationale:** Cluster creation is triggered after a report is persisted. Running it synchronously inside the HTTP request has two failure modes: it delays the citizen's response (bad UX) and it couples cluster evaluation atomicity to the HTTP lifecycle. A background job decouples these.

The job is idempotent by design (RNF-04): if two reports arrive concurrently and both trigger a cluster-creation job, the job uses a PostgreSQL advisory lock to ensure only one cluster is created.

```
HTTP Request (create report)
    │
    ▼
reports_service.ts
    ├─ INSERT report (within RLS transaction)
    ├─ COMMIT
    └─ Dispatch ClusterEvaluationJob(reportId, tenantId, lat, lng, categoryId)
           │
           ▼ (async, outside HTTP lifecycle)
    ClusterEvaluationJob.handle()
           ├─ Acquire advisory lock: pg_try_advisory_lock(tenantId + categoryId + gridCell)
           ├─ Count nearby open reports (ST_DWithin 50m, 7d)
           ├─ If count >= 3 and no cluster exists → CREATE incident
           ├─ Link all qualifying reports to incident
           └─ Release lock
```

**Component boundaries:**

| Component | File | Responsibility |
|-----------|------|---------------|
| Job definition | `app/features/clustering/jobs/cluster_evaluation_job.ts` | Receives payload, owns the evaluation transaction |
| Clustering service | `app/features/clustering/clustering_service.ts` | Pure business logic called by the job; testable without queue |
| Job dispatch | Inside `reports_service.ts` | Only dispatches — no clustering logic here |

**Why not synchronous:** The citizen should get a 201 immediately after their report is persisted. Cluster evaluation is a side effect, not a prerequisite for the report existing.

**Why not a database trigger:** Triggers are invisible to the application layer, bypass service logic, cannot be tested with Japa, and cannot dispatch notifications — all of which are requirements here.

---

## ML Adapter Pattern

### Interface + Mock + Real Implementation

**Confidence: HIGH** — This is a standard dependency inversion pattern.

The ML image screening requirement (RN-014) is implemented as a pluggable adapter so:
1. Tests never call a real HTTP endpoint
2. The real service can be swapped without touching any feature code
3. Contract tests verify the mock and real adapter behave identically

```typescript
// app/shared/contracts/ml_image_screener.ts
export interface MlImageScreener {
  score(imageBuffer: Buffer): Promise<{ score: number; flagged: boolean }>
}
```

```typescript
// app/shared/adapters/ml_image_screener_mock.ts
import type { MlImageScreener } from '#shared/contracts/ml_image_screener'

export class MlImageScreenerMock implements MlImageScreener {
  constructor(private readonly fixedScore: number = 0.1) {}

  async score(_imageBuffer: Buffer) {
    return { score: this.fixedScore, flagged: this.fixedScore >= 0.95 }
  }
}
```

```typescript
// app/shared/adapters/ml_image_screener_http.ts
import type { MlImageScreener } from '#shared/contracts/ml_image_screener'

export class MlImageScreenerHttp implements MlImageScreener {
  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}

  async score(imageBuffer: Buffer) {
    const response = await fetch(`${this.baseUrl}/v1/score`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: imageBuffer,
    })
    if (!response.ok) throw new MlAdapterError(response.statusText)
    const data = await response.json()
    return { score: data.score, flagged: data.score >= 0.95 }
  }
}
```

The active implementation is resolved via the IoC container:

```typescript
// providers/app_provider.ts  (or a dedicated ml_provider.ts)
import app from '@adonisjs/core/services/app'

app.container.bind('MlImageScreener', () => {
  if (app.inTest) return new MlImageScreenerMock()
  return new MlImageScreenerHttp(
    env.get('ML_SERVICE_URL'),
    env.get('ML_SERVICE_API_KEY')
  )
})
```

Services inject it via the container — never import the concrete class directly.

---

## Component Boundaries

| Component | Owns | Communicates With | Does NOT Touch |
|-----------|------|-------------------|----------------|
| `auth` feature | JWT issuance, OAuth, user registration, token refresh | `shared/middleware` for JWT validation | Any other feature's models |
| `reports` feature | Report CRUD, GPS validation, image upload orchestration | `clustering` (dispatch only), `moderation` (dispatch only), `shared/adapters` | `feed` internals, `management` internals |
| `clustering` feature | Cluster creation, incident lifecycle, cascade resolution | `reports` models (read-only queries via own service), notification dispatch | `auth` internals |
| `moderation` feature | Flag logic, ML screening, auto-hide, manager queue | `shared/adapters/ml_image_screener`, `shared/adapters/storage`, `management` | `clustering` logic |
| `feed` feature | Relevance score calculation, ordered feed queries | `reports` model (read), `clustering` model (read) | Writing to any table directly |
| `notifications` feature | Push notification storage, delivery | Events emitted by other features | Direct knowledge of what triggered the notification |
| `management` feature | Audit log, manager actions, flag queue view | All features' models (read); `moderation` service for actions | Citizen-facing routes |
| `shared/middleware` | Tenant context, auth hydration, rate limiting | PostgreSQL (SET LOCAL), Redis (rate limit counters) | Feature business logic |
| `shared/adapters` | ML screener, object storage, email | External HTTP services | Database directly |

**Cross-feature communication rule:** Features may only call each other's *service* layer — never import controllers, models, or validators from another feature. Prefer event-driven communication (Adonis.js Emitter) over direct service calls for side effects (clustering, notifications).

---

## Data Flow: Report Submission (Canonical Example)

```
1. POST /reports
        │
2. TenantMiddleware
        ├─ Validates X-Tenant-ID header
        ├─ Opens DB transaction
        └─ SET LOCAL app.tenant_id = '<tenantId>'

3. AuthMiddleware
        └─ Decodes JWT → ctx.auth.user

4. RateLimitMiddleware
        └─ Checks Redis key: rate:report:<userId>:<date>

5. ReportsController.store()
        └─ Calls CreateReportValidator → validated payload

6. ReportsService.create(payload, ctx)
        ├─ Calls MlImageScreener.score(imageBuffer)
        │     ├─ score >= 0.95 → throw AutoHideError (report hidden immediately)
        │     └─ score < 0.95 → continue
        ├─ Validates GPS proximity (ST_DWithin 200m)
        ├─ Strips EXIF, uploads clean image to public bucket
        ├─ Uploads original+EXIF to private bucket (90-day TTL)
        ├─ INSERT report (RLS active on trx)
        ├─ COMMIT transaction
        └─ Dispatch ClusterEvaluationJob(reportId, ...)

7. Controller returns 201 { data: report }

8. [Async] ClusterEvaluationJob.handle()
        ├─ Acquires advisory lock
        ├─ Counts nearby reports (ST_DWithin 50m, 7d, same category)
        ├─ count >= 3 → creates incident, links reports
        └─ Dispatches NotificationEvent for affected users
```

---

## TDD Mapping to Architecture

**Confidence: HIGH** — Japa is the Adonis.js v6 native test runner; these patterns follow its documented API.

### Test Types and What They Test

| Test Type | Location | Tests | Runs Against |
|-----------|----------|-------|-------------|
| Unit | `app/features/*/tests/unit/` | Service logic in isolation | Mocked DB / in-memory |
| Functional | `app/features/*/tests/functional/` | Full HTTP stack end-to-end | Test DB with RLS active |
| Integration | `tests/integration/` | Cross-feature flows | Test DB |
| RLS contract | `tests/rls/` | Every table, every tenant | Test DB — dedicated suite |

### Unit Test Pattern (Service, no HTTP)

```typescript
// app/features/reports/tests/unit/reports_service.spec.ts
import { test } from '@japa/runner'
import { ReportsService } from '#features/reports/reports_service'
import { MlImageScreenerMock } from '#shared/adapters/ml_image_screener_mock'

test.group('ReportsService.create', () => {
  test('auto-hides report when ML score >= 0.95', async ({ assert }) => {
    const screener = new MlImageScreenerMock(0.97)
    const service = new ReportsService({ mlScreener: screener })

    await assert.rejects(
      () => service.create(validPayload, mockCtx),
      'AutoHideError'
    )
  })
})
```

### Functional Test Pattern (Full HTTP with RLS)

```typescript
// app/features/reports/tests/functional/reports.spec.ts
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

test.group('POST /reports', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('returns 201 with valid payload', async ({ client, assert }) => {
    const tenant = await TenantFactory.create()
    const user = await UserFactory.merge({ tenantId: tenant.id }).create()

    const response = await client
      .post('/reports')
      .header('X-Tenant-ID', tenant.id)
      .loginAs(user)
      .json(validReportPayload)

    response.assertStatus(201)
    assert.exists(response.body().data.id)
  })

  test('rejects submission when GPS is > 200m from pinned location', async ({ client }) => {
    // ... setup ...
    response.assertStatus(422)
  })
})
```

### RLS Contract Test Pattern

```typescript
// tests/rls/tenant_isolation.spec.ts
import { test } from '@japa/runner'

const TABLES = ['reports', 'incidents', 'comments', 'flags', 'notifications']

for (const table of TABLES) {
  test(`${table}: tenant B cannot read tenant A rows`, async ({ assert }) => {
    const { tenantA } = await setupTenantWithData(table)
    const { tenantB } = await setupEmptyTenant()

    await db.rawQuery(`SET LOCAL app.tenant_id = '${tenantB.id}'`)
    const rows = await db.from(table).select('*')

    assert.lengthOf(rows, 0, `RLS leak on ${table}`)
  })
}
```

---

## Build Order (Feature Dependency Graph)

Features must be built in dependency order. A feature should not be started until its dependencies are complete and tested.

```
Phase 1: Foundation
  ├── Database schema + RLS policies (all tables, all policies)
  ├── TenantMiddleware + RLS contract tests
  └── Shared infrastructure (IoC bindings, adapters, exceptions)

Phase 2: Auth
  └── Depends on: Phase 1
      ├── User registration + email/password login
      ├── JWT issuance + refresh
      └── OAuth (Google/Apple) — can be a sub-phase

Phase 3: Reports (Core)
  └── Depends on: Phase 1, Phase 2
      ├── Report submission (GPS validation, image upload, ML screening)
      ├── Report read + status lifecycle (ABERTA → RESOLVIDA)
      └── Rate limiting (5 publications / 24h)

Phase 4: Clustering
  └── Depends on: Phase 3 (needs real reports in DB)
      ├── ClusterEvaluationJob
      ├── Incident model + cascade resolution
      └── Reopen logic (RN-008, RN-009)

Phase 5: Moderation
  └── Depends on: Phase 3 (flags target reports/comments)
      ├── Flag logic + auto-hide thresholds
      ├── ML screening integration (real adapter)
      └── Malicious flag detection + progressive restrictions

Phase 6: Feed
  └── Depends on: Phase 3, Phase 4
      ├── Relevance score formula
      ├── Cluster multiplier
      └── Ordered feed endpoint

Phase 7: Notifications
  └── Depends on: Phase 4, Phase 5
      ├── Event listeners for clustering + moderation events
      ├── Push notification storage
      └── Notification center read endpoint

Phase 8: Management Dashboard API
  └── Depends on: Phase 5, Phase 7
      ├── Flag queue + evidence view
      ├── Manager actions (restore, delete with reason)
      └── Audit log
```

**Critical path:** Phase 1 → Phase 2 → Phase 3 → Phase 4 (all others branch from Phase 3).

---

## Scalability Considerations

| Concern | At launch (single municipality) | At 10 tenants | At 100+ tenants |
|---------|--------------------------------|---------------|-----------------|
| DB connections | Single pool; SET LOCAL per request | Same; monitor pool saturation | Consider PgBouncer in transaction mode |
| Clustering job queue | BullMQ with Redis; single worker | Multiple workers fine | Partition by tenantId for fan-out |
| Geospatial index | GIST index on `location` per table | Same; GiST scales well | Partition tables by tenant if row count exceeds 10M |
| RLS overhead | Negligible (<1ms per query) | Negligible | Confirmed by PostgreSQL benchmarks |
| Image storage | S3-compatible bucket (single bucket, tenant-prefixed keys) | Same | Same |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Global DB Import Inside Services
**What goes wrong:** Service uses global `db` instead of `ctx.db` (the transaction-scoped handle). RLS is not active on new connections. Cross-tenant data leaks.
**Prevention:** ESLint rule to disallow `import db from '@adonisjs/lucid/services/db'` inside `app/features/*/` files. Services receive `trx` as a parameter.

### Anti-Pattern 2: Synchronous Cluster Evaluation
**What goes wrong:** Cluster check delays HTTP response by 50-200ms for every report submission. Under concurrent load, lock contention blocks the response pool.
**Prevention:** Always dispatch a background job. The HTTP response is issued after the report INSERT commits, before the job runs.

### Anti-Pattern 3: Cross-Feature Model Imports
**What goes wrong:** `FeedService` imports `Report` model from `features/reports/models/report.ts`. A schema change to `Report` breaks `FeedService` silently.
**Prevention:** Features expose data via their service layer or events only. Feed queries against the `reports` table directly via raw SQL or a shared read-only model in `shared/`.

### Anti-Pattern 4: RLS Without FORCE
**What goes wrong:** Table owner (e.g. migration user) bypasses RLS. Migration accidentally runs a query that sets `app.tenant_id` incorrectly.
**Prevention:** `FORCE ROW LEVEL SECURITY` on every table. Migration connection uses a dedicated superuser role that is explicitly excluded from RLS by a separate policy — and that role is never used at runtime.

### Anti-Pattern 5: VineJS Validator Shared Across Features
**What goes wrong:** Two features share a `ReportPayloadValidator`. One feature needs to add a field, breaking the other feature's API silently.
**Prevention:** Validators are private to their feature. Duplication is acceptable; coupling is not.

---

## Sources

- Adonis.js v6 official documentation (training data, cutoff Aug 2025) — MEDIUM confidence for framework-specific APIs
- PostgreSQL RLS documentation: `CREATE POLICY`, `SET LOCAL`, `current_setting()` — HIGH confidence (stable PostgreSQL feature)
- PostGIS documentation: `ST_DWithin`, `ST_MakePoint`, `ST_SetSRID`, `ST_AsGeoJSON`, GIST indexes — HIGH confidence (stable PostGIS feature)
- BullMQ / Adonis.js Queue patterns — MEDIUM confidence (training data)
- PROJECT.md explicit constraints and decisions — HIGH confidence (primary source)
