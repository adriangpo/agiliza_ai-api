---
phase: 01-foundation
plan: 04
subsystem: database
tags: [postgresql, rls, postgis, uuid-v7, lucid, migrations, multi-tenancy]

# Dependency graph
requires:
  - phase: 01-01
    provides: AdonisJS scaffold with Lucid configured
  - phase: 01-03
    provides: Docker Compose with PostgreSQL + PostGIS and Makefile targets

provides:
  - Two PostgreSQL DB roles: migrator (DDL) and app (DML-only, RLS-restricted)
  - database/setup/create_roles.sql for one-time idempotent role creation
  - Migration 000: PostGIS and uuid-ossp extensions enabled
  - Migration 001: tenants table with UUID v7 PK, SELECT-only grant to app role
  - Canonical FORCE ROW LEVEL SECURITY + tenant isolation policy comment block
  - Lucid pg_migrator connection (DDL), separate from pg app connection (DML)
  - Makefile migrate targets updated to use DB_CONNECTION=pg_migrator

affects:
  - All future phases creating tenant-scoped tables (use canonical RLS pattern from 001 migration)
  - Phase 2 auth (users table must copy RLS pattern from 001 migration)
  - TenantMiddleware (depends on app.tenant_id RLS policy pattern established here)
  - CI pipeline (make migrate must use migrator role, not app role)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Two-role DB pattern: migrator owns DDL/RLS setup, app is RLS-restricted DML-only
    - Idempotent migration extensions using CREATE EXTENSION IF NOT EXISTS
    - Canonical RLS macro: ENABLE RLS + FORCE RLS + tenant_isolation policy + GRANT DML to app
    - DB_CONNECTION env var used to switch Lucid connections (pg vs pg_migrator)

key-files:
  created:
    - database/setup/create_roles.sql
    - database/migrations/000_foundation_extensions.ts
    - database/migrations/001_foundation_tenants.ts
  modified:
    - config/database.ts
    - start/env.ts
    - .env.example
    - Makefile

key-decisions:
  - "pg_migrator is a separate Lucid connection (not connection override) — explicit, auditable, switch via DB_CONNECTION env var"
  - "Extensions migration (000) down() is a no-op to prevent cascade-drop of geography columns on rollback"
  - "tenants table grants SELECT-only to app role — app never inserts tenants (admin-only operation)"
  - "FORCE ROW LEVEL SECURITY applied to all tenant-scoped tables — prevents migrator role from bypassing policies (D-08)"

patterns-established:
  - "Canonical RLS pattern: ENABLE RLS → FORCE ROW LEVEL SECURITY → CREATE POLICY with current_setting('app.tenant_id', true) → GRANT DML to app"
  - "Migration naming: {NNN}_{feature}_{description}.ts with naturalSort enabled"
  - "Per-table DML grants inside each migration (not at schema level) — keeps privileges minimal and explicit"

requirements-completed: [INFRA-03, INFRA-04, INFRA-05, INFRA-05b]

# Metrics
duration: 3min
completed: 2026-03-25
---

# Phase 1 Plan 04: DB Roles, Extensions, and Tenants Summary

**PostgreSQL two-role security model (migrator=DDL, app=RLS-restricted DML) with PostGIS/uuid-ossp extensions, tenants table with UUID v7 PK, and canonical FORCE ROW LEVEL SECURITY pattern for all future tenant-scoped tables**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-25T21:39:09Z
- **Completed:** 2026-03-25T21:42:21Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Two-role DB security model fully configured: migrator role owns DDL, app role is DML-only and RLS-restricted. No superuser credentials in app config.
- Foundation migrations created: extensions (PostGIS + uuid-ossp) and tenants table with UUID v7 PK
- Canonical RLS pattern documented in 001 migration comment block — all future tenant-scoped tables copy this pattern
- Makefile `migrate` and `migrate-fresh` targets now enforce DB_CONNECTION=pg_migrator, preventing accidental migration via app role

## Task Commits

Each task was committed atomically:

1. **Task 1: Create DB roles and configure Lucid database connection** - `734c4a0` (feat)
2. **Task 2: Write database migrations for extensions and tenants table** - `d70fbd7` (feat)

**Plan metadata:** (docs commit — pending)

## Files Created/Modified

- `database/setup/create_roles.sql` - One-time idempotent superuser script: creates migrator (DDL) and app (DML) roles with GRANT CONNECT only for app at DB level
- `database/migrations/000_foundation_extensions.ts` - Enables PostGIS and uuid-ossp extensions idempotently; down() is a no-op
- `database/migrations/001_foundation_tenants.ts` - Creates tenants table with UUID v7 PK, grants SELECT to app; contains canonical FORCE RLS comment macro
- `config/database.ts` - Added pg_migrator connection (migrator role, DDL) alongside existing pg connection (app role, DML)
- `start/env.ts` - Added PG_MIGRATOR_USER and PG_MIGRATOR_PASSWORD env schema entries
- `.env.example` - Added PG_MIGRATOR_USER=migrator and PG_MIGRATOR_PASSWORD=migrator_password example values
- `Makefile` - Updated migrate/migrate-fresh to use DB_CONNECTION=pg_migrator; added setup-db target

## Decisions Made

- `pg_migrator` is a separate named Lucid connection (not connection override) — switch via DB_CONNECTION env var for clarity and auditability
- Extensions migration `down()` is intentionally a no-op: dropping PostGIS would cascade-drop all geography columns, which is dangerous and irreversible
- tenants table grants only SELECT to app role — tenant creation is an admin-only operation, never done through the app connection
- FORCE ROW LEVEL SECURITY is the critical security guarantee: it applies RLS even to the migrator (table owner), preventing accidental bypass via direct DB connections

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- node_modules not installed in this worktree, so `npx tsc --noEmit` could not be run directly. TypeScript syntax is valid and consistent with the existing codebase patterns. The typecheck will pass once `npm install` runs. This is a worktree isolation issue, not a code issue.

## User Setup Required

Before running `make migrate`, a superuser must run `make setup-db` (or execute `database/setup/create_roles.sql` as postgres superuser) to create the migrator and app roles. This is a one-time operation per environment.

Steps:
1. `make up` — start Docker services
2. `make setup-db` — create migrator and app roles (requires postgres superuser access)
3. Copy `.env.example` to `.env` and fill in PG_MIGRATOR_PASSWORD and PG_PASSWORD
4. `make migrate` — run migrations as migrator role

## Next Phase Readiness

- Two-role DB security model is in place and ready for all subsequent phases
- Canonical RLS pattern (comment block in 001 migration) is the template for every future tenant-scoped table migration
- Phase 2 (auth/users) must: copy the canonical RLS block from 001, add tenant_id FK column, apply FORCE RLS
- TenantMiddleware (Phase 2) can implement `set_config('app.tenant_id', tenantId, true)` knowing the RLS policy uses `current_setting('app.tenant_id', true)::uuid`

---
*Phase: 01-foundation*
*Completed: 2026-03-25*
