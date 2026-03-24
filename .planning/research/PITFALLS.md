# Domain Pitfalls

**Project:** Agiliza Aí API
**Domain:** Multi-tenant civic reporting API (AdonisJS v7 + PostgreSQL RLS + PostGIS)
**Researched:** 2026-03-23 (original); **partially superseded 2026-03-24** — framework is v7, not v6. RLS and PostgreSQL pitfalls below still apply. Any v6-specific pitfalls (like "custom BullMQ provider") are obsolete.
**Confidence:** MEDIUM–HIGH for RLS/DB patterns; verify AdonisJS-specific pitfalls against v7 docs

---

## Critical Pitfalls

Mistakes that cause data leakage, silent test passes, or rewrites.

---

### Pitfall C-1: RLS Session Variable Leaks via Connection Pool

**What goes wrong:** PostgreSQL RLS policies that rely on `SET LOCAL app.tenant_id = '...'` or `SET app.tenant_id = '...'` behave differently depending on whether you use `SET` (session scope) or `SET LOCAL` (transaction scope). In a connection pool (Knex/Lucid uses `pg` under the hood), connections are reused. If you use session-scoped `SET` and a request ends without resetting it, the next request that picks up the same connection inherits the previous tenant's context. Cross-tenant data is returned silently — no error, no warning.

**Why it happens:** Developers copy patterns from blogs that use `SET` (session scope) without understanding that connection pools never close connections between requests.

**Consequences:**
- Tenant A's data returned to Tenant B's authenticated user.
- RLS appears to work in tests (test isolation uses transactions that roll back, resetting `SET LOCAL` automatically) but fails in production under load.
- Silent failure — no exception is thrown.

**Prevention:**
- Always use `SET LOCAL app.tenant_id = '...'` inside an explicit transaction, not bare `SET`.
- Alternatively use `set_config('app.tenant_id', $1, true)` with `is_local = true` (the third parameter), which is equivalent to `SET LOCAL` and is safe inside transactions.
- The Adonis middleware that sets tenant context MUST wrap every request in a transaction or use `set_config` with `is_local = true` inside a per-request transaction.
- Write a test that opens two concurrent requests with different tenants and asserts no cross-contamination.

**Detection (warning signs):**
- Integration test passes but a manual multi-tab browser test shows wrong data.
- Tests always pass because each test runs in a rolled-back transaction (resetting SET LOCAL automatically).
- Grep for bare `SET app.` without `LOCAL` in migrations or middleware.

**Phase address:** Foundation / Multi-tenancy setup phase (day one).

---

### Pitfall C-2: PgBouncer Transaction Mode Breaks SET LOCAL

**What goes wrong:** If PgBouncer (or any pgpool) is placed in front of PostgreSQL in `transaction` pooling mode (the most efficient mode), any `SET` or `SET LOCAL` executed outside an explicit `BEGIN...COMMIT` block is issued on a connection that is immediately returned to the pool after the statement. The setting is therefore ephemeral and has no effect on subsequent queries in the same logical request, because those queries run on a different physical connection.

**Why it happens:** PgBouncer transaction mode reassigns the connection after every statement. There is no "session" from PgBouncer's perspective when you're not in a transaction.

**Consequences:**
- `set_config('app.tenant_id', ...)` appears to succeed but the RLS policy reads `NULL` from `current_setting('app.tenant_id', true)`, causing RLS to evaluate to `false` (blocking all data) or `true` (leaking all data, depending on policy design).
- Silent data return of wrong tenant or empty result set.

**Prevention:**
- In PgBouncer `transaction` mode: every request that needs RLS context MUST issue `BEGIN` first, set the config inside the transaction, run all queries, then `COMMIT`. Lucid's `db.transaction()` wrapper does this correctly.
- Alternative: use PgBouncer in `session` mode (lower connection density but correct behaviour for SET). Session mode is safer but sacrifices scalability.
- Alternative: use a `before_execute` Knex hook to `set_config` inside a wrapTransaction, never relying on connection-level state.
- **Do not use PgBouncer transaction mode without auditing every RLS context-setting call.** This is a production-only bug that won't surface in development (which typically skips PgBouncer).

**Detection:**
- Deploy a staging environment with PgBouncer in transaction mode and run the cross-tenant leakage test suite against it explicitly.
- No local dev failure — this only appears under PgBouncer or pgpool.

**Phase address:** Infrastructure / deployment phase. Flag in multi-tenancy phase to design for it from the start.

---

### Pitfall C-3: RLS Bypass by Superuser / Migration Runner

**What goes wrong:** PostgreSQL RLS is bypassed for superusers and table owners by default (`BYPASSRLS` privilege). If migrations are run as the same DB user that the API uses at runtime, and if that user owns the tables, RLS policies are silently bypassed. All tests pass, production data is unprotected.

**Why it happens:** Default behaviour of PostgreSQL. Easy to miss because everything "works."

**Consequences:**
- All RLS policies are dead code. Any query from the API user returns all rows regardless of tenant.

**Prevention:**
- Use two separate database roles: a `migrator` role (table owner, superuser or `BYPASSRLS`) for running migrations, and an `app` role (not owner, no `BYPASSRLS`) for runtime queries.
- Grant the `app` role `SELECT, INSERT, UPDATE, DELETE` on the tables explicitly. Never make the runtime role the table owner.
- Verify: `SELECT current_user;` in a test should return the `app` role, not `postgres` or the migration role.
- Test: connect as the `app` role without setting `app.tenant_id` — the query should return zero rows (not all rows).

**Detection:**
- `\dp tablename` in psql — the `app` role should NOT appear as owner.
- A test that deliberately omits the tenant context setter and asserts zero rows is returned.

**Phase address:** Foundation / database setup. Non-negotiable from migration 001.

---

### Pitfall C-4: Clustering Race Condition — Duplicate Parent Incidents

**What goes wrong:** The rule "create a parent incident when 3+ same-category reports appear within 50m and 7 days" is checked and acted on by each incoming submission. Under concurrent load (two submissions arriving simultaneously, both being the "third" report), both pass the threshold check before either has written the parent incident. Result: two parent incidents are created for the same cluster.

**Why it happens:** The check-then-act pattern without locking. Both requests read "2 existing reports, threshold not met yet," then both write the third report and both trigger parent creation.

**Consequences:**
- Duplicate parent incidents. Resolving one does not cascade to the other. Reports split across two parents. Data inconsistency.

**Prevention:**
- Use a PostgreSQL advisory lock keyed on `(tenant_id, category, geohash_of_area)` for the cluster creation critical section.
- Alternative: use a database-level `INSERT ... ON CONFLICT DO NOTHING` with a unique constraint on `(tenant_id, category, grid_cell_id)` for the parent incident, combined with a post-insert check that reassigns orphaned children.
- Alternative: use `SELECT ... FOR UPDATE` on a "cluster zone" record before the threshold check, serialising the critical section.
- The idempotency requirement (RNF-04) mandates this is solved in the cluster creation service, not left to retry logic.
- Write a concurrent test that fires 5 simultaneous submissions for the same location/category and asserts exactly 1 parent incident is created.

**Detection:**
- `SELECT COUNT(*) FROM incidents WHERE parent_id IS NULL AND category = X AND ST_DWithin(...)` returning > 1 for the same logical cluster.
- No concurrent test that deliberately fires parallel submissions — absence of this test is itself a warning sign.

**Phase address:** Clustering / lifecycle phase.

---

### Pitfall C-5: Geofencing Using Euclidean Distance on Geographic Coordinates

**What goes wrong:** The requirement "block submission if GPS is more than 200m from the pinned location" and "cluster reports within 50m" are spatial distance checks. A naive implementation uses `sqrt((lat2-lat1)^2 + (lon2-lon1)^2)` or Knex/Lucid raw math. At Brazilian latitudes (~5° to ~33° S), 1 degree of longitude ≠ 1 degree of latitude in meters. Euclidean distance on lat/lon is incorrect and introduces errors of 10–30%.

**Why it happens:** Developers treat coordinates as flat Cartesian coordinates. The error is small enough to pass manual testing but causes incorrect geofencing at cluster boundaries and near the 200m threshold.

**Consequences:**
- A submission 220m away is accepted (or one 180m away is rejected) because the distance calculation is wrong.
- Clusters form incorrectly — reports that should cluster don't, or reports too far apart get merged.

**Prevention:**
- Use PostGIS `ST_DWithin(geography, geography, meters)` which uses the WGS84 spheroid. This is the only correct approach.
- Store coordinates as `GEOMETRY(Point, 4326)` or `GEOGRAPHY(Point, 4326)` columns. Use `geography` type for distance queries — it works in meters natively.
- The 200m GPS drift check (server-side validation) and the 50m clustering check MUST both use PostGIS geography functions.
- Never implement distance checks in application-layer JavaScript/TypeScript — always push to the database.

**Detection:**
- A unit test that checks a point exactly 201m away is rejected. If the test uses JS math to assert "201m", it will incorrectly pass even with a broken implementation.
- Write the test using known coordinate pairs with a pre-calculated geodesic distance (use an online calculator with the WGS84 ellipsoid to generate the test fixture).

**Phase address:** Geo & Reporting phase.

---

### Pitfall C-6: JWT Secret Rotation and Stateless Token Invalidation

**What goes wrong:** AdonisJS v6 JWT auth (`@adonisjs/auth` with `jwt` guard) issues stateless tokens. There is no built-in token revocation. When a user deletes their account (RN-005) or a manager suspends a user (RN-020), existing JWT tokens remain valid until expiry. The user can continue making API calls.

**Why it happens:** Stateless JWTs are designed to not require a revocation store — that's the tradeoff developers accept. It becomes a bug when the product has account deletion and suspension flows.

**Consequences:**
- Deleted account continues to operate until token expiry.
- Suspended user continues to post and flag until token expiry.
- GDPR / data deletion compliance risk: a "deleted" user's actions still succeed.

**Prevention:**
- Implement a token blocklist for sensitive operations (logout, account deletion, suspension). Redis is the standard store. On each authenticated request, check the blocklist before processing.
- Use short-lived access tokens (15 min) + refresh tokens. Short expiry limits the revocation window.
- On user deletion: add `jti` (JWT ID claim) to blocklist. Lucid model hooks on `delete` should trigger this.
- In `@adonisjs/auth` v6: the `jwt` guard does not ship with revocation. This must be implemented in a custom auth middleware.

**Detection:**
- No test that deletes a user then asserts subsequent API calls with the old token return 401.
- No test that suspends a user and asserts immediate rejection.

**Phase address:** Auth phase (account deletion), Moderation phase (suspension).

---

### Pitfall C-7: AdonisJS v6 IoC Container — Decorator vs Constructor Injection Confusion

**What goes wrong:** AdonisJS v6 moved from the magic `@inject()` decorator + string-based IoC of v5 to a TypeScript-native IoC container. In v6, constructor injection uses `@inject()` only for classes not registered as singletons — but the common pitfall is mixing `container.make()` with `new MyService()`. Using `new` bypasses the container entirely, meaning injected dependencies (like `db`, `emitter`, `logger`) are `undefined` at runtime.

**Why it happens:** Developers familiar with v5 or other frameworks call `new Controller()` in tests or try to instantiate services directly. In v6, all classes meant to use DI must be resolved through `container.make()` or injected via the framework's route/controller binding.

**Consequences:**
- `TypeError: Cannot read properties of undefined` at runtime when a service method calls `this.db.query(...)`.
- Tests that `new MyService()` in isolation pass (because they mock everything) but integration tests fail mysteriously.

**Prevention:**
- Never use `new` for classes that have `@inject()` — always use `container.make(MyService)`.
- In Japa tests, use `testUtils.app.container.make(MyService)` to resolve services rather than constructing them.
- Establish a rule: if a class constructor accepts parameters, it uses DI. Document this in the project's contributing guide.

**Detection:**
- Grep for `new [A-Z].*Service(` or `new [A-Z].*Controller(` outside factory definitions — these are likely DI violations.

**Phase address:** Foundation / architecture setup.

---

### Pitfall C-8: Adonis v6 Middleware — Named vs Anonymous, and Global vs Route-Level

**What goes wrong:** In v6, middleware registration changed significantly from v5. Middleware must be registered in `start/kernel.ts` as named middleware (for route-level use) or in the global stack. A common mistake is registering tenant-context middleware as a named middleware but forgetting to apply it to every route group, allowing unauthenticated or non-tenant-scoped requests to reach controllers. Another mistake is ordering middleware incorrectly — auth middleware must run before tenant-resolution middleware (tenant is resolved from the authenticated user's claim).

**Why it happens:** v6 changed from `Server.middleware` chaining to an explicit named/global split. Developers port v5 patterns verbatim.

**Consequences:**
- Routes that skip auth middleware serve data without tenant context, triggering either an RLS error (if `app.tenant_id` is NULL and the policy uses `IS NOT NULL`) or a full data leak (if the policy falls through to TRUE).

**Prevention:**
- Tenant context middleware MUST be in the global stack (after auth), never a named optional middleware.
- Or: apply it at the router group level to every authenticated route group explicitly, and write a test that calls an endpoint without an auth token and asserts 401 (not 200 or 403).
- Order in `start/kernel.ts`: `[AuthMiddleware, TenantContextMiddleware, ...]` — auth before tenant.

**Detection:**
- An unauthenticated request to a protected route returning 200 or 500 (instead of 401).
- Missing test for "request without Authorization header."

**Phase address:** Foundation / middleware setup.

---

## Moderate Pitfalls

---

### Pitfall M-1: Japa Test Isolation — Database State Bleeding Between Tests

**What goes wrong:** Japa runs tests in the same process with a shared database connection. Without explicit cleanup, row inserts from one test persist into the next. This causes test-order dependencies: tests that happen to run after a "polluting" test pass; run in a different order and they fail. The issue is especially deceptive with factories that generate realistic-looking data.

**Prevention:**
- Use `testUtils.db().withGlobalTransaction()` in `tests/bootstrap.ts` to wrap every test suite in a rolled-back transaction. This is the standard pattern for Adonis v6 Japa integration tests.
- Alternatively, use `testUtils.db().migrate()` with `truncate()` hooks. The transaction approach is faster.
- Never rely on `afterEach` truncation alone — it misses the case where a test throws before cleanup.
- Factories MUST use the test's transaction context, not a separate connection. Pass `{ client: trx }` to factory calls in tests.

**Detection:**
- A test that passes when run in isolation but fails when run as part of the full suite.
- `SELECT COUNT(*)` in a test setup finding unexpected rows.

**Phase address:** Every phase — establish the pattern in the foundation phase.

---

### Pitfall M-2: Tenant Context Not Set in Tests — False Green RLS Tests

**What goes wrong:** A test creates a tenant, creates a user under that tenant, and makes an API call. The test expects only that tenant's data in the response. But the test runs inside a transaction that also happens to have rolled back the `set_config` call, and the RLS policy's `current_setting('app.tenant_id', true)` returns NULL. The RLS policy was written to `USING (tenant_id = current_setting('app.tenant_id')::uuid)` — which evaluates to NULL = NULL = false, returning zero rows. The test asserts "response has 1 item" and fails. The developer "fixes" it by changing the policy to `USING (tenant_id = current_setting('app.tenant_id', true)::uuid OR current_setting('app.tenant_id', true) IS NULL)` — which turns off RLS for unauthenticated contexts. This is a critical security regression masked as a test fix.

**Prevention:**
- The correct fix: the test must explicitly set the tenant context via `db.rawQuery("SELECT set_config('app.tenant_id', $1, true)", [tenantId])` inside the test's transaction context before making assertions.
- Write a dedicated "RLS enforcement test" that asserts zero rows when no tenant context is set (not an error — zero rows is correct and safe).
- Policy must never include an `OR ... IS NULL` escape hatch.

**Detection:**
- An RLS policy containing `IS NULL` or `= ''` as an escape condition.
- A test setup that does not explicitly call `set_config` before asserting data.

**Phase address:** Multi-tenancy phase.

---

### Pitfall M-3: ESLint v9 Flat Config — Plugin Compatibility

**What goes wrong:** ESLint v9 uses flat config (`eslint.config.js`) by default and drops support for `.eslintrc.*` files. Many ESLint plugins (especially `eslint-plugin-adonis`, older TypeScript plugins, and Prettier integrations) still ship with legacy configs that use `require('eslint').Linter.Config` or the old `extends` syntax. Using them in a flat config file without the compatibility layer (`@eslint/eslintrc` compat utility) causes `Cannot read property 'rules' of undefined` errors at lint startup.

**Prevention:**
- Check every plugin's README for flat config support before adding it to `eslint.config.js`.
- For plugins without native flat config support, use `FlatCompat` from `@eslint/eslintrc`:
  ```js
  import { FlatCompat } from '@eslint/eslintrc'
  const compat = new FlatCompat()
  export default [...compat.extends('plugin:some-legacy-plugin/recommended')]
  ```
- `@typescript-eslint/eslint-plugin` v6+ supports flat config natively — use it directly.
- `eslint-config-prettier` v9+ supports flat config natively.
- Pin plugin versions and test lint in CI from project initialization — don't discover this in week 3.

**Detection:**
- `TypeError` at ESLint startup mentioning `undefined` config properties.
- A plugin's GitHub issues having open tickets titled "flat config support."

**Phase address:** Foundation / tooling setup.

---

### Pitfall M-4: EXIF Metadata Leaking via Public Image Delivery

**What goes wrong:** The requirement (RNF-02) says public image delivery must strip all EXIF metadata. A naive implementation uploads the raw image to a public S3/R2 bucket and serves it directly. The original file contains GPS coordinates, device make/model, and potentially the user's home address (if taken at home). This is a PII/GDPR violation.

**Prevention:**
- The image processing pipeline must strip EXIF before writing to the public bucket. Use Sharp (`sharp`) with `.withMetadata(false)` (the default in Sharp — withMetadata must be explicitly called to preserve, so omitting it is safe).
- Store the original (with EXIF) only in the private bucket (requirement RN-016: private for 90 days, moderator-only).
- Two distinct upload paths: `processForPublic(file)` → strips EXIF, writes to public bucket; `storeOriginal(file)` → no processing, writes to private bucket.
- Test by uploading a known EXIF-bearing image and asserting the public URL's response headers/body contain no GPS EXIF tags.

**Detection:**
- Download a publicly served image and run `exiftool` on it — GPS tags present is a failure.
- No test that verifies EXIF absence in the public delivery path.

**Phase address:** Media upload phase.

---

### Pitfall M-5: Relevance Score Staleness — Computed at Query Time vs Materialised

**What goes wrong:** The relevance formula `(Likes × 0.5) + (Comments × 1.0) + (Shares × 1.5)` with a cluster multiplier requires aggregating engagement counters. Computing this on every feed query via `COUNT(*)` subqueries or joins on large tables is a full-table aggregation per feed page load. At moderate data volumes this becomes the primary performance bottleneck.

**Prevention:**
- Maintain a `relevance_score` column on the `incidents` table, updated via triggers or application-layer hooks on every like/comment/share event.
- Use PostgreSQL `GENERATED ALWAYS AS (expression) STORED` if the formula uses only same-row columns (it doesn't — it requires counts from related tables, so triggers are needed).
- Alternative: materialised view refreshed on a schedule. Acceptable if eventual consistency in feed ordering is tolerable.
- The feed query becomes `ORDER BY relevance_score DESC, created_at DESC` — a fast indexed sort.

**Detection:**
- `EXPLAIN ANALYZE` on a feed query showing sequential scans or nested loops over engagement tables.
- Feed endpoint response time exceeding 200ms on a dataset of 10,000 incidents.

**Phase address:** Feed & engagement phase.

---

### Pitfall M-6: Cascading Resolution Missing Child Incidents Due to ORM N+1

**What goes wrong:** Resolving a parent incident cascades resolution to all child incidents (RN-007). A naive implementation loads all child incidents via `parent.related('children').query()` and calls `child.save()` in a loop. With 100+ children, this fires 100+ individual UPDATE queries. Under a database transaction, this is slow and holds locks for longer than necessary.

**Prevention:**
- Use a single bulk UPDATE: `db.from('incidents').where('parent_incident_id', parentId).update({ status: 'RESOLVED', resolved_at: DateTime.now() })`.
- Wrap in the same transaction as the parent resolution.
- Emit a single domain event `ParentIncidentResolved` and handle notification fan-out asynchronously (not in the synchronous request).

**Detection:**
- Adonis query log showing N individual UPDATE queries where N = number of child incidents.
- A test that creates a parent with 50 children and asserts the cascade completes in < 500ms will surface this.

**Phase address:** Lifecycle phase.

---

## Minor Pitfalls

---

### Pitfall Mi-1: GPS Accuracy Check is Client-Only

**What goes wrong:** The requirement "block submission if GPS accuracy is worse than 50m" (US-01) is enforced only by the mobile client. The server API does not validate the `accuracy` field sent in the request. A malicious or misconfigured client can omit the field or send `accuracy: 1` regardless of actual GPS quality.

**Prevention:**
- Server-side VineJS validator must include `accuracy` as a required numeric field with a max value of 50. Reject submissions where `accuracy > 50` with a 422.
- Test: send a POST request with `accuracy: 100` and assert 422.

**Phase address:** Geo & Reporting phase.

---

### Pitfall Mi-2: Rate Limiting Per-IP Not Per-Tenant

**What goes wrong:** Rate limiting flags (RNF-08) and publications (RN-002) per-IP without also scoping to tenant means a citizen in Municipality A can exhaust the IP-level flag rate limit and block a citizen in Municipality B sharing the same NAT IP (e.g., mobile carrier NAT). Conversely, a malicious actor behind many IPs in one tenant can bypass per-IP limits.

**Prevention:**
- Use a composite rate limit key: `tenant_id:user_id` for authenticated actions (primary), `tenant_id:ip` for anonymous/unauthenticated actions (fallback). Never raw IP alone.
- The 5 publications/24h window (RN-002) is per-user, not per-IP — already specified correctly. The IP limit is a secondary abuse-prevention layer.

**Phase address:** Auth / rate-limiting phase.

---

### Pitfall Mi-3: Soft Delete vs Hard Delete — Anonymisation on Account Deletion

**What goes wrong:** RN-005 says publications are anonymised to "Cidadão Anônimo" on account deletion, not deleted. A naive implementation deletes the user row with a CASCADE that wipes all their publications. The requirement is anonymisation, not deletion.

**Prevention:**
- Account deletion: null out or replace `user_id` on publications with a sentinel value, update the display name to "Cidadão Anônimo". The user row is deleted (or soft-deleted for audit trail).
- Do not use `CASCADE DELETE` on the `user_id` foreign key for publications. Use `ON DELETE SET NULL` or handle it explicitly in the service layer.
- Test: delete a user, then fetch their publications — assert they exist with anonymised author.

**Phase address:** Identity & access phase.

---

### Pitfall Mi-4: AdonisJS v6 Lucid ORM — `useTransaction` Scope Not Propagated Automatically

**What goes wrong:** When wrapping operations in `db.transaction(async (trx) => { ... })`, any Lucid model method called inside the callback must explicitly receive `{ client: trx }` or use `.useTransaction(trx)`. If a service method called inside the transaction creates its own internal Lucid query without the transaction client, those queries execute on a separate connection outside the transaction and are NOT rolled back on error.

**Why it happens:** Lucid does not have ambient/implicit transaction propagation. Each query builder is independent.

**Prevention:**
- Every service method that participates in a transaction must accept a `trx` parameter and pass it down.
- Pattern: `MyModel.query({ client: trx }).where(...)` — not `MyModel.query().where(...)`.
- In the cluster creation service (which must be atomic), pass the transaction client through all sub-calls.

**Detection:**
- An integration test that triggers an error mid-transaction and asserts all changes are rolled back. If partial data persists, a query is escaping the transaction.

**Phase address:** Every phase that uses transactions — especially clustering and cascading resolution.

---

### Pitfall Mi-5: Comment Locking at 30 Days — Clock Skew in Tests

**What goes wrong:** RN-011 says tickets resolved more than 30 days ago accept no new comments. This is implemented as `resolved_at < NOW() - INTERVAL '30 days'`. In tests, using `DateTime.now()` at factory creation time and then immediately testing the lock condition fails unless the test explicitly backdates the `resolved_at` timestamp.

**Prevention:**
- Factories must accept an override for `resolved_at`. Tests that verify the 30-day lock must set `resolved_at: DateTime.now().minus({ days: 31 })`.
- Never test time-dependent behaviour with "close to the boundary" values — use clearly over-boundary values (31 days, not 30 days 1 minute).

**Phase address:** Lifecycle phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Foundation / DB setup | Superuser bypasses RLS (C-3) | Two DB roles from migration 001 |
| Multi-tenancy middleware | Session-scoped SET leaks (C-1) | Use `set_config(..., true)` inside transaction |
| Multi-tenancy middleware | PgBouncer transaction mode breaks SET (C-2) | Design for transaction-scoped context from day one |
| Auth / JWT | No token revocation on deletion/suspension (C-6) | Token blocklist in Redis at auth phase |
| Auth / JWT | AdonisJS DI — `new` bypasses container (C-7) | `container.make()` convention enforced in linting |
| Middleware ordering | Tenant context before auth (C-8) | Auth → TenantContext order in kernel.ts |
| Geo & Reporting | Euclidean distance error (C-5) | PostGIS `ST_DWithin` with `geography` type |
| Geo & Reporting | GPS accuracy server-bypass (Mi-1) | VineJS validator rejects accuracy > 50 |
| Clustering | Race condition on parent creation (C-4) | Advisory lock or `ON CONFLICT DO NOTHING` |
| Clustering / cascades | N+1 on child resolution (M-6) | Bulk UPDATE, async notification fan-out |
| Media upload | EXIF leak on public URL (M-4) | Sharp strips metadata before public bucket write |
| Feed / engagement | Relevance score computed at query time (M-5) | Materialised score column, updated by triggers |
| Identity / deletion | CASCADE DELETE removes publications (Mi-3) | `ON DELETE SET NULL`, anonymise in service |
| Lifecycle | 30-day lock clock skew in tests (Mi-5) | Explicit backdated `resolved_at` in test factories |
| TDD foundation | DB state bleeding between tests (M-1) | `withGlobalTransaction()` in bootstrap |
| TDD foundation | False-green RLS tests (M-2) | Explicit `set_config` in every test using RLS |
| Tooling | ESLint v9 flat config plugin breakage (M-3) | Check flat config support before adding plugins |
| Rate limiting | Per-IP without tenant scope (Mi-2) | Composite key `tenant_id:user_id` |

---

## Sources

- PostgreSQL RLS documentation (training data, HIGH confidence for RLS semantics and bypass rules)
- PgBouncer transaction mode behaviour (training data, HIGH confidence — well-documented limitation)
- AdonisJS v6 documentation and changelog (training data, MEDIUM confidence — v6 released 2023, stable by 2024)
- Japa v3 test runner patterns for AdonisJS v6 (training data, MEDIUM confidence)
- ESLint v9 flat config migration guide (training data, HIGH confidence — released 2024)
- PostGIS geography vs geometry type distance semantics (training data, HIGH confidence)
- Sharp image processing library EXIF handling (training data, HIGH confidence)

**Note:** WebSearch and WebFetch were unavailable during this research session. All findings are based on training data. For pitfalls C-1, C-2, C-3, and C-4 (RLS, PgBouncer, race conditions), verify against current AdonisJS v6 documentation and any official multi-tenancy guides before implementing. Pitfalls M-3 (ESLint) and C-7 (DI container) should be verified against current plugin changelogs and AdonisJS v6 release notes at implementation time.
