---
phase: 02-authentication-identity
plan: 04
subsystem: auth
tags: [routes, bouncer-policy, cross-tenant, documentation, tdd, rls, mermaid]

# Dependency graph
requires:
  - phase: 02-02
    provides: "register/login/logout routes, PublicTenantMiddleware, AuthController"
  - phase: 02-03
    provides: "SocialAuthController, UsersController, AccountService, profile/deletion tests"
provides:
  - "All 7 auth endpoints wired in routes.ts with correct middleware chains"
  - "UserPolicy: Bouncer policy enforcing self-only account deletion (AUTH-07, D-12)"
  - "Cross-tenant isolation tests: same email in different tenants, token isolation"
  - "docs/features/auth/API.md: complete endpoint documentation with Mermaid sequence diagrams"
  - "docs/features/auth/MODELS.md: data model documentation with Mermaid ER diagram, RLS policy SQL"
affects:
  - "All authenticated endpoints — routes.ts is the entry point"
  - "AccountService.deleteAccount signature changed (now accepts ctx.db trx)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Routes split into 3 groups: public (publicTenant), OAuth (publicTenant), authenticated (auth + tenant)"
    - "withGlobalTransaction() is mandatory for ALL auth tests — publicTenantMiddleware uses set_config inside savepoint which propagates app.tenant_id to outer transaction; without it, global Lucid model queries have no tenant context and fail RLS"
    - "AccountService.deleteAccount accepts ctx.db trx parameter — prevents nested db.transaction() conflict with withGlobalTransaction() teardown"
    - "set_config with is_local=true inside a nested savepoint: the value propagates to the outer transaction, which means sequential tenant-switching requests in the same global transaction will overwrite app.tenant_id"
    - "Cross-tenant isolation tests use separate test.group() boundaries for each tenant scenario — prevents app.tenant_id contamination between groups"

key-files:
  created:
    - "app/features/auth/routes.ts — updated: all 7 endpoints with publicTenant, auth+tenant middleware chains"
    - "app/features/auth/policies/user_policy.ts — UserPolicy.deleteAccount self-only enforcement"
    - "app/features/auth/tests/functional/cross_tenant.spec.ts — cross-tenant isolation tests"
    - "docs/features/auth/API.md — complete API docs with Mermaid sequence diagrams, pt-BR error messages"
    - "docs/features/auth/MODELS.md — data model docs with Mermaid ER diagram, RLS policy SQL"
  modified:
    - "app/features/auth/services/account_service.ts — accept ctx.db trx, remove internal db.transaction()"
    - "app/features/auth/controllers/users_controller.ts — pass ctx.db to AccountService.deleteAccount"
    - "app/features/auth/tests/functional/account_deletion.spec.ts — add X-Tenant-ID, withGlobalTransaction, fix ? bindings"
    - "app/features/auth/tests/functional/profile.spec.ts — add X-Tenant-ID header, withGlobalTransaction"
    - "app/features/auth/tests/functional/social_auth.spec.ts — add X-Tenant-ID header, withGlobalTransaction"
    - "adonisrc.ts, app/abilities/main.ts, app/middleware/initialize_bouncer_middleware.ts — prettier auto-fix"
    - "tests/rls/tenant_isolation.spec.ts — prettier auto-fix"

key-decisions:
  - "AccountService.deleteAccount refactored to accept ctx.db transaction handle — opening db.transaction() inside TenantMiddleware's transaction + withGlobalTransaction() causes teardown hang; using ctx.db avoids the third nesting level"
  - "withGlobalTransaction() is mandatory for all auth feature tests because publicTenantMiddleware sets app.tenant_id inside a savepoint, and the global Lucid model queries (User.create, User.accessTokens.create) use the outer connection which only has app.tenant_id via the savepoint inheritance"
  - "Cross-tenant test groups use separate withGlobalTransaction boundaries to prevent app.tenant_id contamination between sequential requests with different tenant headers"
  - "Google OAuth callback test kept as .skip(true) — ally mock not available in test environment; manual verification required"

# Metrics
duration: 74min
completed: 2026-03-27
---

# Phase 02 Plan 04: Route Wiring, Bouncer Policy, Cross-Tenant Tests, and Docs Summary

**All 7 auth endpoints wired with correct middleware chains, UserPolicy enforcing self-deletion, cross-tenant isolation tests, and complete API/MODELS documentation with Mermaid diagrams**

## Performance

- **Duration:** ~74 min
- **Started:** 2026-03-27T22:45:05Z
- **Completed:** 2026-03-27T23:59:27Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments

- **Routes wired (Task 1):** `app/features/auth/routes.ts` now registers all 7 auth endpoints: POST /auth/register, POST /auth/login, GET /auth/google/redirect, GET /auth/google/callback (public via `publicTenant`), POST /auth/logout, GET /users/me, DELETE /users/me (protected via `auth + tenant` middleware chain)
- **Bouncer UserPolicy (Task 1):** Created `app/features/auth/policies/user_policy.ts` with `deleteAccount(currentUser, targetUser)` returning `currentUser.id === targetUser.id` (AUTH-07, D-12)
- **Cross-tenant isolation tests (Task 1, TDD):** 3 tests in `cross_tenant.spec.ts` — same email can register in different tenants (RLS unique constraint per tenant), token from tenant A resolves to tenant A user (TenantMiddleware reads auth.user.tenantId), unauthenticated request returns 401
- **API documentation (Task 2):** `docs/features/auth/API.md` — all 7 endpoints documented with Mermaid sequence diagrams, pt-BR error messages, client-side token handling guidance (iOS Keychain / Android Keystore)
- **Data model documentation (Task 2):** `docs/features/auth/MODELS.md` — users/auth_access_tokens/oauth_identities tables with Mermaid ER diagram, column definitions, bigint FK warning for tokenable_id, RLS policy SQL

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 6ed9040 | feat(02-04): wire all 7 auth routes, add UserPolicy, cross-tenant isolation tests |
| Task 2 | e2a3b17 | feat(02-04): create API.md + MODELS.md docs, fix tests and lint across auth feature |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Fixed account_deletion.spec.ts, profile.spec.ts, social_auth.spec.ts: missing X-Tenant-ID headers**
- **Found during:** Task 2 (full suite verification)
- **Issue:** All 3 test files from Plan 03 called `/auth/register` without `X-Tenant-ID` header. `publicTenantMiddleware` returns 400 for missing header, causing setup hooks to fail
- **Fix:** Added `X-Tenant-ID` header and `withGlobalTransaction()` pattern to all 3 test files
- **Files modified:** `account_deletion.spec.ts`, `profile.spec.ts`, `social_auth.spec.ts`
- **Commit:** e2a3b17

**2. [Rule 1 - Bug] Fixed AccountService.deleteAccount: nested db.transaction() caused test teardown hang**
- **Found during:** Task 2 (account_deletion test execution)
- **Issue:** `AccountService.deleteAccount()` called `db.transaction()` internally, creating a 3rd level of nesting inside `TenantMiddleware.db.transaction()` and `withGlobalTransaction()`. The Japa teardown couldn't roll back the outer transaction, causing the test process to hang indefinitely
- **Fix:** Changed `AccountService.deleteAccount` to accept `trx: TransactionClientContract` parameter. Updated `UsersController.deleteMe` to pass `ctx.db` (TenantMiddleware's transaction handle). Removed `db.transaction()` from AccountService — all DB operations now run within the context transaction
- **Files modified:** `account_service.ts`, `users_controller.ts`
- **Commit:** e2a3b17

**3. [Rule 1 - Bug] Fixed Lucid rawQuery binding syntax: $1 → ?**
- **Found during:** Task 2 (account_deletion tests)
- **Issue:** Test queries used PostgreSQL-native `$1` binding syntax. Lucid's `rawQuery` uses Knex-style `?` positional bindings
- **Fix:** Changed all `$1` to `?` in rawQuery calls in `account_deletion.spec.ts`
- **Files modified:** `account_deletion.spec.ts`
- **Commit:** e2a3b17

**4. [Rule 1 - Bug] Fixed cross-tenant test: multi-registration in same withGlobalTransaction causes app.tenant_id contamination**
- **Found during:** Task 1 (cross-tenant TDD)
- **Issue:** Doing 2 sequential `/auth/register` requests in the same `withGlobalTransaction()` test caused app.tenant_id to be set to the second tenant (from publicTenantMiddleware's savepoint inheritance), making subsequent auth token lookups fail with 401
- **Fix:** Split cross-tenant tests into separate `test.group()` boundaries — each group gets its own `withGlobalTransaction()` outer transaction, preventing app.tenant_id contamination between tenant-switching registrations
- **Files modified:** `cross_tenant.spec.ts`
- **Commit:** 6ed9040

**5. [Rule 3 - Pre-existing] Fixed prettier lint errors in pre-existing files**
- **Found during:** Task 2 (lint check)
- **Issue:** `adonisrc.ts`, `app/abilities/main.ts`, `app/middleware/initialize_bouncer_middleware.ts`, `tests/rls/tenant_isolation.spec.ts` had prettier formatting errors from Plan 01
- **Fix:** Auto-fixed via `eslint --fix`
- **Files modified:** 4 files listed above
- **Commit:** e2a3b17

## Pre-existing Failures (not fixed, deferred)

The following 4 test failures existed before Plan 02-04 and are outside scope:
1. `TenantMiddleware / set_config value resets after transaction ends` — Foundation unit test (Phase 1 regression)
2. `RLS: Tenant Isolation Contract / set_config with is_local=true: value is NULL outside transaction` — RLS test (Phase 1)
3. `RLS: Tenant Isolation Contract / FORCE RLS enforcement: tenant A cannot read tenant B rows at DB layer` — RLS test (Phase 1)
4. `RLS: Tenant Isolation Contract / FORCE RLS null safety: no tenant_id set returns zero rows` — RLS test (Phase 1)

These failures are unrelated to auth route wiring and are tracked in the Phase 01 context.

## Test Results

- **Auth feature tests:** 24 passed, 1 skipped (OAuth callback — ally mock not available)
- **Full suite:** 28 passed, 4 failed (pre-existing Phase 1 failures), 1 skipped

## Self-Check: PASSED

### Files exist:
- FOUND: app/features/auth/routes.ts (contains all 7 endpoints)
- FOUND: app/features/auth/policies/user_policy.ts (UserPolicy with deleteAccount)
- FOUND: app/features/auth/tests/functional/cross_tenant.spec.ts
- FOUND: start/routes.ts (imports #features/auth/routes)
- FOUND: docs/features/auth/API.md (contains mermaid, sequenceDiagram)
- FOUND: docs/features/auth/MODELS.md (contains erDiagram, FORCE ROW LEVEL SECURITY)

### Commits exist:
- FOUND: 6ed9040 — feat(02-04): wire all 7 auth routes, add UserPolicy, cross-tenant isolation tests
- FOUND: e2a3b17 — feat(02-04): create API.md + MODELS.md docs, fix tests and lint across auth feature
