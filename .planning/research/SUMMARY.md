# Research Summary: Agiliza Aí API

**Project:** Agiliza Aí API
**Domain:** Multi-tenant municipal citizen-reporting REST API (311-style, SaaS, Brazil)
**Researched:** 2026-03-23 (original) — **SUPERSEDED 2026-03-24**
**⚠ OUTDATED:** Framework switched to AdonisJS v7. See `CLAUDE.md` for the canonical v7 stack and `01-RESEARCH.md` for phase-level research.

---

## Recommended Stack (key decisions only)

AdonisJS v7 (Node.js 24 required) is the target framework. Scaffold with `npm create adonisjs@latest <name> -- --kit=api`. All first-party packages are wired via `node ace add <pkg>` (replaces `node ace configure`). **Do not use v5 or v6 packages** — they are incompatible with the v7 container and ESM conventions.

| Technology | Role | Why |
|---|---|---|
| `@adonisjs/core` ^6.12 | HTTP, router, DI container | Mandated; ESM-native |
| `@adonisjs/lucid` ^21 + `pg` ^8 | ORM + PostgreSQL driver | Framework-native ORM; migrations, factories, test DB lifecycle |
| `@adonisjs/auth` ^9 (JWT guard) | Auth + token issuance | Stateless JWT; tenant context in payload; no sessions |
| `@adonisjs/ally` ^5 | OAuth (Google, Apple) | Official v6 package; server-side exchange for mobile clients |
| `@vinejs/vine` ^2 | Validation | Bundled in v6 scaffold; replaces v5 `@adonisjs/validator` (do not install old pkg) |
| PostgreSQL + PostGIS 3.x | DB + geospatial queries | RLS for tenant isolation; `ST_DWithin` for 200m/50m constraints |
| `bullmq` ^5 + `ioredis` ^5 | Background jobs | Durable, Redis-backed; required for async cluster detection (RNF-04) |
| `@adonisjs/limiter` ^2 | Rate limiting | Redis-backed; per-user + per-IP; multi-process safe |
| `@adonisjs/drive` ^2 | Object storage | Local-in-tests, S3-in-prod; no code changes to swap |
| `sharp` ^0.33 | EXIF stripping + image processing | `.withMetadata(false)` strips EXIF before public bucket write |
| `geolib` ^3.3 | GPS distance validation (JS layer) | Haversine for submission validator; PostGIS is authoritative for DB-level checks |
| Japa ^3 + `@japa/api-client` | Test runner | AdonisJS-native; manages DB lifecycle; do not use Jest/Vitest |
| ESLint v9 (flat config) + Prettier ^3 | Linting + formatting | Use `@adonisjs/eslint-config` and `@adonisjs/prettier-config`; do not use `.eslintrc.json` |

**All semver versions are from training data (cutoff Aug 2025). Verify every package on npm before pinning.**

---

## Table Stakes Features (what must ship in v1)

These are non-negotiable. Missing any one makes the platform unusable or indistinguishable from a generic form tool.

| Feature | SRS Reference | Notes |
|---|---|---|
| User registration + JWT auth (email/pass + OAuth) | RN-001 | Multi-tenant identity; role: citizen / manager / admin |
| Multi-tenancy with PostgreSQL RLS | RLS section | Database-enforced; middleware-activated; all queries scoped |
| Complaint submission with category + GPS | RN-001, RN-003, US-01 | Core citizen action |
| GPS proximity validation (200m + 50m accuracy) | RN-003, US-01 | Block fraudulent or inaccurate reports at the server |
| Photo attachment with EXIF stripping | RN-014, RN-016, RNF-02 | Public delivery strips EXIF; original stored privately 90 days |
| Ticket status lifecycle (ABERTA → RESOLVIDA / FECHADA) | RN-008, RN-009 | Foundation for all manager actions |
| Rate limiting on submissions (5/24h per user) | RN-002, RNF-08 | Redis-backed; also per-IP for flags |
| Manager review queue + status transitions | US-04, US-05 | Platform is useless to operators without this |
| Audit log of moderation actions | RNF-07 | Append-only; legal requirement for government context |
| Status push notifications | RN-019 | Without feedback the platform is a black hole |
| Anonymous/pseudonymous public display | RN-001, RN-005 | LGPD compliance; deleted users become "Cidadão Anônimo" |
| Comment thread (frozen 30 days post-resolution) | RN-011, RN-012 | Community context for managers |
| Basic feed ordered by relevance score | RN-017, RN-018 | (Likes×0.5)+(Comments×1.0)+(Shares×1.5); cluster ×2 |

**Defer to after core is stable:**
- Spatial clustering + cascade resolution (RN-006, RN-007) — technically complex, idempotency-sensitive
- Collaborative flagging + malicious flag detection (RN-012, RN-015, RN-020) — depends on volume
- ML image content screening real adapter (RN-014) — ship with mock first, wire real service later
- Relevance score decay, per-image limits, Open311 export, SLA tracking — explicitly out of scope v1

---

## Architecture in One Page

**Pattern:** Layered + feature-based vertical slices. Each feature owns its controller, service, policy, routes, validators, models, and tests. Features communicate only through their service layer or domain events (AdonisJS Emitter) — never via direct model imports across feature boundaries.

```
HTTP Request
  → TenantMiddleware       (SET LOCAL app.tenant_id; wraps request in DB transaction)
  → AuthMiddleware          (decode JWT → ctx.auth.user)
  → RateLimitMiddleware     (Redis-backed sliding window)
  → Controller              (validate input → call service)
  → Service                 (business logic, transactions, emits events)
  → Lucid Model             (data access; RLS active on trx)
  → PostgreSQL + PostGIS
```

**Feature modules and build order:**

```
Phase 1: Foundation
  ├── DB schema + RLS policies (all tables, two DB roles: migrator + app)
  ├── TenantMiddleware + RLS contract tests
  └── Shared infrastructure: IoC bindings, adapters (ML screener mock, storage), exceptions

Phase 2: Auth
  └── User registration, JWT issuance/refresh, OAuth (Google/Apple), token blocklist

Phase 3: Reports (Core)
  └── Submission (GPS validation, EXIF strip, ML screening mock), lifecycle, rate limiting

Phase 4: Clustering
  └── ClusterEvaluationJob (async, BullMQ), incident model, cascade resolution, reopen logic

Phase 5: Moderation
  └── Flag logic, auto-hide thresholds, ML real adapter wired, malicious pattern detection

Phase 6: Feed
  └── Relevance score formula, cluster multiplier, ordered feed endpoint, materialised score column

Phase 7: Notifications
  └── Event listeners, push notification storage, notification center read endpoint

Phase 8: Management Dashboard API
  └── Flag queue, manager actions (restore/delete with reason), audit log, manager analytics
```

**ML adapter is pluggable from day one** — `MlImageScreener` interface with mock in tests and HTTP implementation in production, resolved via IoC container. Never import the concrete class directly in feature code.

**Cross-tenant leakage tests are mandatory in every functional test suite.** Every authenticated route gets an RLS contract test asserting tenant B cannot read tenant A's data (response must be 404, not 403).

---

## Top 5 Pitfalls to Avoid

1. **RLS session variable leaking through connection pool (C-1)**
   Always use `SET LOCAL` (or `set_config('app.tenant_id', id, true)`) inside an explicit transaction. Session-scoped `SET` reuses the previous tenant's context on pooled connections. This is a silent data leak — no error thrown. The `TenantMiddleware` must wrap the entire request in `db.transaction()`.

2. **Superuser / migration role bypasses RLS (C-3)**
   PostgreSQL RLS is bypassed for table owners by default. Use two DB roles: a `migrator` role (table owner, used only during migrations) and an `app` role (no ownership, always subject to RLS). The runtime API must connect as the `app` role. Verify with `SELECT current_user` in a test.

3. **Clustering race condition — duplicate parent incidents (C-4)**
   Two concurrent submissions both pass the "3+ nearby reports" threshold check before either writes the parent incident. Use a PostgreSQL advisory lock keyed on `(tenant_id, category, geohash)` — or `INSERT ... ON CONFLICT DO NOTHING` — inside the `ClusterEvaluationJob`. Write a test that fires 5 simultaneous submissions for the same location and asserts exactly 1 parent incident.

4. **JWT tokens remain valid after account deletion or suspension (C-6)**
   Stateless JWTs have no built-in revocation. Implement a Redis token blocklist — checked on every authenticated request — and add `jti` claims to the blocklist on logout, deletion, and suspension. Use short-lived access tokens (15 min) + refresh tokens to cap the revocation window.

5. **Euclidean distance on geographic coordinates (C-5)**
   At Brazilian latitudes, 1° longitude ≠ 1° latitude in meters. All distance checks (200m GPS drift, 50m cluster radius) MUST use PostGIS `ST_DWithin(geography, geography, meters)` — never JS-layer Euclidean math. Store coordinates as `GEOGRAPHY(Point, 4326)` columns and index with GIST.

**Also critical:**
- Never use global `db` import inside service files — always pass the transaction handle (`trx`) from middleware through to every DB call (Mi-4). ESLint rule to enforce this.
- Never write an RLS policy with an `IS NULL` escape hatch — it disables tenant isolation for unauthenticated contexts (M-2).
- `TenantMiddleware` runs after `AuthMiddleware` in `start/kernel.ts` — auth before tenant resolution (C-8).

---

## Open Questions (unresolved decisions that affect planning)

| Question | Impact | Recommended Action |
|---|---|---|
| Is `@adonisjs/queue` (BullMQ wrapper) stable and v6-ready? | If not, build a custom BullMQ provider — adds 1–2 days | Verify on npm before Phase 1; fallback plan documented in STACK.md |
| Exact import path for JWT guard in `@adonisjs/auth` v9 | Blocks Phase 2 if wrong | Check official docs on project kickoff; do NOT use community JWT packages |
| Does `@adonisjs/ally` v5 include an Apple Sign-In driver? | OAuth scope for Phase 2 | Check ally driver list; may need community package for Apple |
| Will PgBouncer be used in the deployment stack? | If yes, `SET LOCAL` requires all queries inside explicit `BEGIN...COMMIT` — Lucid's `db.transaction()` handles this, but pooler mode must be `session` or the design must be audited | Decide infrastructure topology before Phase 1 DB setup |
| ML image screening service selection | Phase 5 real adapter implementation depends on the service's HTTP contract | Product decision; mock adapter allows Phase 3 to proceed regardless |
| Per-image count limit (recommended 5 in SRS, unspecified) | Without a spec decision, enforcing a limit is a breaking change later | Resolve in requirements before Phase 3 media upload |

---

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Stack | MEDIUM | Package versions from training data (Aug 2025 cutoff); patterns HIGH confidence |
| Features | HIGH | Table stakes cross-referenced against Open311, FixMyStreet, SeeClickFix; thresholds from SRS |
| Architecture | MEDIUM-HIGH | PostgreSQL RLS + PostGIS patterns HIGH; AdonisJS v6-specific wiring MEDIUM |
| Pitfalls | MEDIUM-HIGH | RLS/PgBouncer/PostGIS pitfalls HIGH; AdonisJS v6 DI patterns MEDIUM |

**Overall confidence: MEDIUM-HIGH**

The domain is well-understood (civic 311 platforms are a solved problem). The architecture decisions (RLS, feature slices, BullMQ) are sound and confirmed by multiple independent sources. The main uncertainty is AdonisJS v6 package semver — all versions must be verified on npm before the first `package.json` is committed.

---

## Sources

### Primary (HIGH confidence)
- `.planning/PROJECT.md` SRS v1.4 — authoritative for all business rules, thresholds, and constraints
- PostgreSQL RLS documentation — `CREATE POLICY`, `SET LOCAL`, `current_setting()`, `FORCE ROW LEVEL SECURITY`
- PostGIS documentation — `ST_DWithin`, `ST_MakePoint`, `ST_SetSRID`, `ST_AsGeoJSON`, GIST indexes
- PgBouncer transaction mode behaviour — documented limitation for session variables
- Open311 GeoReport v2 spec — table stakes feature baseline
- ESLint v9 flat config migration guide

### Secondary (MEDIUM confidence)
- AdonisJS v6 documentation (training data, Aug 2025) — framework APIs, middleware conventions, DI container
- Japa v3 test runner patterns — DB lifecycle, `withGlobalTransaction`, factory conventions
- BullMQ ^5 documentation — job definitions, advisory locks, retry/backoff
- FixMyStreet / SeeClickFix feature patterns — differentiator feature baseline

### Tertiary (LOW confidence)
- `knex-postgis` ^0.14 — optional PostGIS helper; verify Lucid v21 compatibility before adopting; raw SQL is always a safe fallback
- `@adonisjs/queue` official wrapper — verify current release status on npm before Phase 1

---

*Research completed: 2026-03-23*
*Ready for roadmap: yes*
