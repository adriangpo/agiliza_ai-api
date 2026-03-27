---
phase: 02-authentication-identity
plan: 02
subsystem: auth
tags: [adonis, opaque-tokens, vinejs, rls, postgresql, japa, tdd]

# Dependency graph
requires:
  - phase: 02-01
    provides: User model with DbAccessTokensProvider, auth_access_tokens migration, app/pg_migrator DB roles
provides:
  - POST /auth/register — 201 with oat_ token + public user profile, 409 on duplicate, 422 on validation
  - POST /auth/login — 200 with oat_ token, 401 with pt-BR generic message
  - POST /auth/logout — 204, deletes token, 401 on replay
  - AuthService with per-role token abilities (citizen vs manager)
  - PublicTenantMiddleware for X-Tenant-ID header on public routes
affects:
  - 02-03-profile-endpoint
  - 02-04-oauth-social-login
  - 03-submissions
  - any authenticated feature

# Tech tracking
tech-stack:
  added: []
  patterns:
    - PublicTenantMiddleware reads X-Tenant-ID header and sets app.tenant_id via set_config with is_local=true
    - withAuthFinder mixin on User model enables User.verifyCredentials(email, password)
    - Auth routes split into public group (publicTenant middleware) and authenticated group (auth + tenant middleware)
    - VineJS registerValidator enforces D-16 password complexity (uppercase + digit) and D-26 XSS escape on displayName
    - Test setup: withGlobalTransaction() + db.table('tenants').insert() within same transaction for test isolation

key-files:
  created:
    - app/features/auth/controllers/auth_controller.ts
    - app/features/auth/services/auth_service.ts
    - app/features/auth/validators/register_validator.ts
    - app/features/auth/validators/login_validator.ts
    - app/features/auth/routes.ts
    - app/features/auth/tests/functional/register.spec.ts
    - app/features/auth/tests/functional/login.spec.ts
    - app/features/auth/tests/functional/logout.spec.ts
    - app/shared/middleware/public_tenant_middleware.ts
  modified:
    - app/models/user.ts (added withAuthFinder mixin)
    - start/kernel.ts (registered publicTenant named middleware)
    - start/routes.ts (imported auth routes)
    - tests/bootstrap.ts (migrate via pg_migrator, GRANT INSERT on tenants for tests)
    - database/migrations/000_foundation_extensions.ts (disableTransactions, try/catch for PostGIS)
    - database/migrations/001_foundation_tenants.ts (schema.raw instead of db.rawQuery for GRANT)
    - lefthook.yml (use ./node_modules/.bin/ for worktree compatibility)
    - .gitignore (exclude database/schema.ts and .adonisjs/)

key-decisions:
  - "PublicTenantMiddleware reads X-Tenant-ID header for public routes (register/login); tenant context for authenticated routes comes from auth.user.tenantId via TenantMiddleware"
  - "Test tenants inserted via app connection within withGlobalTransaction so HTTP server sees same uncommitted data"
  - "Lucid GRANT must use schema.raw() (deferred) not db.rawQuery() (immediate) to run after CREATE TABLE"
  - "Test bootstrap uses pg_migrator connection for migrations; GRANT INSERT ON tenants TO app added after migrations for test isolation"
  - "lefthook.yml uses ./node_modules/.bin/ paths instead of pnpm exec for git worktree compatibility"

patterns-established:
  - "Pattern: PublicTenantMiddleware — reads X-Tenant-ID header, verifies tenant in DB, sets ctx.tenantId + transaction-scoped app.tenant_id"
  - "Pattern: Test isolation — withGlobalTransaction() wraps all DB ops; test tenant created via app connection so HTTP server shares visibility"
  - "Pattern: Error messages in pt-BR per UI-SPEC Copywriting Contract (D-21)"
  - "Pattern: VineJS validators separate from controllers; registerValidator vs loginValidator split prevents credential policy leakage"

requirements-completed: [AUTH-01, AUTH-03, AUTH-04, AUTH-05]

# Metrics
duration: 180min
completed: 2026-03-27
---

# Phase 02 Plan 02: Auth Register/Login/Logout Summary

**Opaque token auth via AdonisJS v7 auth v10: register/login/logout with tenant-scoped RLS, per-role abilities, and 10 functional tests (TDD GREEN)**

## Performance

- **Duration:** ~180 min (includes multi-iteration infra debugging)
- **Started:** 2026-03-27T18:00:00Z
- **Completed:** 2026-03-27T22:00:00Z
- **Tasks:** 2 (Task 1: RED tests, Task 2: GREEN implementation)
- **Files modified:** 17

## Accomplishments
- All 10 auth functional tests GREEN: register (4/4), login (3/3), logout (3/3)
- Per-role token abilities: citizens get scoped abilities, managers get `['*']`
- PublicTenantMiddleware enables tenant-scoped public routes via `X-Tenant-ID` header
- Token lifecycle correct: opaque `oat_` prefix, 90-day expiry, instant revocation on logout
- VineJS validation: email (254), password (8-72, complexity), displayName (XSS escaped)
- pt-BR error messages per UI-SPEC Copywriting Contract (no user enumeration on 401)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create register + login test stubs (RED)** - `10a8f22` (test)
2. **Task 2: Implement AuthController, AuthService, and validators (GREEN)** - `20bb8b0` (feat)

**Plan metadata:** (docs commit pending)

_Note: TDD tasks have two commits — test (RED) then feat (GREEN)_

## Files Created/Modified
- `app/features/auth/controllers/auth_controller.ts` - register/login/logout handlers
- `app/features/auth/services/auth_service.ts` - createToken with per-role abilities
- `app/features/auth/validators/register_validator.ts` - VineJS email/password/displayName with complexity
- `app/features/auth/validators/login_validator.ts` - VineJS minimal login schema
- `app/features/auth/routes.ts` - public group (publicTenant) + authenticated group
- `app/features/auth/tests/functional/register.spec.ts` - 4 tests: 201/409/422/422
- `app/features/auth/tests/functional/login.spec.ts` - 3 tests: 200/401/401
- `app/features/auth/tests/functional/logout.spec.ts` - 3 tests: 204/401/401
- `app/shared/middleware/public_tenant_middleware.ts` - X-Tenant-ID header reader
- `app/models/user.ts` - added withAuthFinder mixin for verifyCredentials
- `start/kernel.ts` - registered publicTenant named middleware
- `start/routes.ts` - imported auth feature routes
- `tests/bootstrap.ts` - pg_migrator migration, GRANT INSERT on tenants for tests
- `database/migrations/000_foundation_extensions.ts` - disableTransactions + try/catch
- `database/migrations/001_foundation_tenants.ts` - schema.raw() for deferred GRANT
- `lefthook.yml` - ./node_modules/.bin/ for worktree compatibility
- `.gitignore` - exclude auto-generated database/schema.ts and .adonisjs/

## Decisions Made
- **PublicTenantMiddleware pattern**: Public routes (register/login) receive tenant context from `X-Tenant-ID` header instead of `auth.user`. Required because no authenticated user exists yet.
- **Test tenant via app connection**: Inserting test tenants via `db.table('tenants')` (default app connection) within `withGlobalTransaction()` ensures the HTTP server sees the same uncommitted row. Using pg_migrator connection would bypass the transaction.
- **Deferred GRANT via schema.raw()**: Lucid's `this.schema.*` calls are queued and executed after `up()` returns. `this.db.rawQuery()` runs immediately, before `CREATE TABLE` completes. GRANTs on new tables must use `this.schema.raw()`.
- **Test bootstrap pg_migrator migration**: The `app` role has no DDL permissions (no `CREATE TABLE`). Running migrations requires the pg_migrator role.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Created PublicTenantMiddleware for tenant context on public routes**
- **Found during:** Task 2 (register implementation)
- **Issue:** Plan referenced tenant context but provided no mechanism for unauthenticated public routes to receive it. Register/login have no bearer token, so TenantMiddleware cannot read from `auth.user`.
- **Fix:** Created `app/shared/middleware/public_tenant_middleware.ts` that reads `X-Tenant-ID` header, verifies tenant exists in DB, sets `ctx.tenantId` and transaction-scoped `app.tenant_id` via `set_config('app.tenant_id', value, 'true')`.
- **Files modified:** `app/shared/middleware/public_tenant_middleware.ts`, `start/kernel.ts`, auth test files (header + tenant setup)
- **Verification:** All register/login tests pass with tenant scoping
- **Committed in:** `20bb8b0`

**2. [Rule 1 - Bug] Added withAuthFinder mixin to User model**
- **Found during:** Task 2 (login implementation)
- **Issue:** `User.verifyCredentials()` was referenced in the plan but not available — User model was missing the `withAuthFinder` mixin from `@adonisjs/auth/mixins/lucid`.
- **Fix:** Applied `withAuthFinder` mixin with scrypt hash, `uids: ['email']`, `passwordColumnName: 'password'`. Removed duplicate manual `@beforeSave` hash hook.
- **Files modified:** `app/models/user.ts`
- **Verification:** Login tests pass, password hashing still works via mixin
- **Committed in:** `20bb8b0`

**3. [Rule 1 - Bug] Fixed migration GRANT using deferred schema.raw() instead of immediate db.rawQuery()**
- **Found during:** Task 2 (migration debugging)
- **Issue:** `001_foundation_tenants.ts` used `await this.db.rawQuery('GRANT SELECT ON tenants TO app')` which ran immediately — before `this.schema.createTable('tenants', ...)` executed. Result: GRANT on non-existent table.
- **Fix:** Changed to `this.schema.raw('GRANT SELECT ON tenants TO app')` which is deferred and runs after DDL.
- **Files modified:** `database/migrations/001_foundation_tenants.ts`
- **Verification:** Migrations run cleanly, GRANT applied after table creation
- **Committed in:** `20bb8b0`

**4. [Rule 3 - Blocking] Fixed PostGIS migration to disable transactions and handle missing extension**
- **Found during:** Task 2 (test run setup)
- **Issue:** `000_foundation_extensions.ts` tried `CREATE EXTENSION postgis` inside a transaction (Lucid default), but PostgreSQL cannot run DDL extensions inside transactions. Also, PostGIS not installed locally.
- **Fix:** Added `static disableTransactions = true` and try/catch wrappers to skip missing extensions gracefully.
- **Files modified:** `database/migrations/000_foundation_extensions.ts`
- **Verification:** Migrations run without error on local machines without PostGIS
- **Committed in:** `20bb8b0`

**5. [Rule 3 - Blocking] Fixed test bootstrap to use pg_migrator role for migrations and grant INSERT on tenants**
- **Found during:** Task 2 (test run)
- **Issue 1:** `testUtils.db().migrate()` used `app` role which has no DDL permissions. Migrations fail with "permission denied to create table".
- **Issue 2:** After migrations, `app` has SELECT-only on tenants (production policy), but tests need INSERT to create test tenants within `withGlobalTransaction()`.
- **Fix:** Changed to `testUtils.db('pg_migrator').migrate()` and added post-migration `GRANT INSERT ON tenants TO app` via pg_migrator connection.
- **Files modified:** `tests/bootstrap.ts`
- **Verification:** All 10 auth tests run without DB permission errors
- **Committed in:** `20bb8b0`

**6. [Rule 3 - Blocking] Updated lefthook.yml for git worktree compatibility**
- **Found during:** Task 2 (commit attempt)
- **Issue:** `pnpm exec` in lefthook hooks failed in git worktrees because the worktree has an empty `node_modules` — pnpm cannot find package binaries.
- **Fix:** Updated `lefthook.yml` to use `./node_modules/.bin/eslint`, `./node_modules/.bin/prettier`, `./node_modules/.bin/tsc` (resolved via symlinks to root `.bin`). Added `.pnpm` symlink in worktree `node_modules`.
- **Files modified:** `lefthook.yml`, `.gitignore`
- **Verification:** All pre-commit hooks pass (format, lint, typecheck)
- **Committed in:** `20bb8b0`

---

**Total deviations:** 6 auto-fixed (2 missing critical, 2 bugs, 2 blocking)
**Impact on plan:** All auto-fixes necessary for correctness, security, and test infrastructure. No scope creep.

## Issues Encountered
- Multi-role DB setup (app vs pg_migrator) required careful coordination between migration execution, permission grants, and test isolation pattern. The `withGlobalTransaction()` constraint (all ops must use same connection) drove the test design.
- PostGIS extension unavailability on local dev machine required defensive migration code.

## User Setup Required
None — no external service configuration required beyond existing `.env` with PostgreSQL credentials.

## Next Phase Readiness
- Auth endpoints fully functional and tested
- Token lifecycle correct: issue on register/login, delete on logout, 401 on replay
- PublicTenantMiddleware pattern established for any future public route needing tenant context
- Ready for: profile endpoint (02-03), OAuth social login (02-04), or submissions feature (Phase 03)

---
*Phase: 02-authentication-identity*
*Completed: 2026-03-27*
