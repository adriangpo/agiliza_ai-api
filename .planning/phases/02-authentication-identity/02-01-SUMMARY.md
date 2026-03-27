---
phase: 02-authentication-identity
plan: 01
subsystem: auth
tags: [adonisjs-auth, adonisjs-ally, adonisjs-bouncer, postgres, lucid, opaque-tokens, rls, oauth, google-oauth]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "TenantMiddleware, tenants table with UUID PK, RLS infrastructure, pnpm setup, ESLint/Prettier/TypeScript"
provides:
  - "@adonisjs/auth v10 with opaque access tokens guard configured (config/auth.ts)"
  - "@adonisjs/ally v6 with Google OAuth provider configured (config/ally.ts)"
  - "@adonisjs/bouncer v4 with initialize middleware registered"
  - "users table migration with bigIncrements PK, uuid tenant_id FK, ENABLE + FORCE ROW LEVEL SECURITY, tenant-scoped unique email"
  - "auth_access_tokens table migration with bigInteger tokenable_id FK (bigint-safe)"
  - "oauth_identities table migration with VARCHAR provider (extensible), per-tenant unique constraint"
  - "User Lucid model with DbAccessTokensProvider (90-day expiry, oat_ prefix, 40-char secret)"
  - "OAuthIdentity Lucid model with belongsTo User"
affects:
  - "02-02 (registration endpoint) — depends on User model and users migration"
  - "02-03 (login endpoint) — depends on auth config and User.accessTokens provider"
  - "02-04 (OAuth callback) — depends on config/ally.ts and OAuthIdentity model"
  - "All subsequent phases using auth guard"

# Tech tracking
tech-stack:
  added:
    - "@adonisjs/ally v6.0.0 — Google OAuth2"
    - "@adonisjs/bouncer v4.0.0 — authorization policies"
  patterns:
    - "DbAccessTokensProvider.forModel(User) — opaque token config on model static property"
    - "serializeAs: null — exclude sensitive fields from JSON responses"
    - "serializeAs: 'joinedAt' — rename createdAt in public API response"
    - "@beforeSave password hashing — skip when null (OAuth-only accounts)"
    - "FORCE ROW LEVEL SECURITY — all tenant-scoped tables subject to RLS even for table owner"
    - "bigIncrements/bigInteger FK pair — users.id is bigint serial; all FKs use bigInteger"
    - "VARCHAR(20) for provider — extensible without migration"

key-files:
  created:
    - "config/ally.ts — Google OAuth configuration"
    - "database/migrations/002_auth_users.ts — users table with RLS"
    - "database/migrations/003_auth_access_tokens.ts — access tokens with bigInteger FK"
    - "database/migrations/004_auth_oauth_identities.ts — OAuth identities linking table"
    - "app/models/user.ts — User Lucid model"
    - "app/models/oauth_identity.ts — OAuthIdentity Lucid model"
    - "app/abilities/main.ts — bouncer abilities scaffold"
    - "app/middleware/initialize_bouncer_middleware.ts — bouncer init middleware (API-only)"
    - ".generated/policies.ts — empty policies index (auto-generated on dev/build)"
  modified:
    - "package.json — added ally, bouncer deps; added #abilities/* and #generated/* aliases"
    - "adonisrc.ts — added ally_provider, bouncer_provider; bouncer commands; indexPolicies hook"
    - "start/env.ts — added GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL"
    - ".env.example — added Google OAuth vars"
    - "start/kernel.ts — added initialize_bouncer_middleware to router stack"
    - ".adonisjs/server/controllers.ts — cleared scaffold-generated controller references"

key-decisions:
  - "Used DbAccessTokensProvider directly on User model static property (no withAuthFinder mixin) — auth v10 opaque tokens pattern; verifyCredentials available on User via tokensUserProvider at route level"
  - "Removed scaffold-generated controllers/validators/transformers — they used old User schema (fullName, initials, verifyCredentials) and wrong location (should be in app/features/auth/); will be replaced in plans 02-02 through 02-04"
  - "Created .generated/policies.ts manually — bouncer's indexPolicies assembler hook auto-generates this during dev/build; empty export needed for typecheck to pass before any policies exist"
  - "Removed Edge template view sharing from initialize_bouncer_middleware — API-only project; ctx.view does not exist"
  - "password column is nullable — supports OAuth-only accounts (after account deletion, password is set to null)"

patterns-established:
  - "Pattern 1: FORCE ROW LEVEL SECURITY on all tenant-scoped tables — enforced via raw SQL in migration up()"
  - "Pattern 2: bigIncrements/bigInteger FK pair — never use integer() for FK to a bigIncrements column"
  - "Pattern 3: serializeAs: null on all internal/sensitive model columns — email, password, role, tenantId, deletedAt"
  - "Pattern 4: serializeAs: 'aliasName' for public API rename — createdAt → joinedAt"
  - "Pattern 5: #generated/* alias for assembler-generated files — created manually for CI/typecheck compatibility"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

# Metrics
duration: ~25min
completed: 2026-03-27
---

# Phase 02 Plan 01: Auth Foundation Setup Summary

**Opaque access tokens auth stack with users/auth_access_tokens/oauth_identities migrations, User + OAuthIdentity Lucid models, Google OAuth config, and Bouncer authorization foundation**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-27T19:20:00Z
- **Completed:** 2026-03-27T19:45:00Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- Installed and configured @adonisjs/ally v6 (Google OAuth) and @adonisjs/bouncer v4 — both registered as providers in adonisrc.ts
- Created 3 auth migrations: users table with FORCE ROW LEVEL SECURITY + per-tenant unique email; auth_access_tokens with bigInteger FK (bigint-safe); oauth_identities with VARCHAR(20) provider string for extensibility
- Created User model with DbAccessTokensProvider (90-day opaque tokens, oat_ prefix) and OAuthIdentity model — all sensitive fields excluded via `serializeAs: null`, `createdAt` aliased to `joinedAt`

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @adonisjs/auth, @adonisjs/ally, @adonisjs/bouncer and run ace configure** - `c2f64e9` (feat)
2. **Task 2: Create users, auth_access_tokens, and oauth_identities migrations** - `a6d7fcc` (feat)
3. **Task 3: Create User and OAuthIdentity Lucid models** - `4a3c49c` (feat)

## Files Created/Modified

- `config/ally.ts` — Google OAuth provider config with env var references
- `database/migrations/002_auth_users.ts` — users table: bigIncrements PK, uuid tenant_id FK, FORCE ROW LEVEL SECURITY with current_setting policy, unique(tenant_id, email)
- `database/migrations/003_auth_access_tokens.ts` — auth_access_tokens: bigInteger tokenable_id (critical FK type), hash unique index
- `database/migrations/004_auth_oauth_identities.ts` — oauth_identities: bigInteger user_id FK, VARCHAR(20) provider, unique(tenant_id, provider, provider_user_id)
- `app/models/user.ts` — User Lucid model with full accessTokens provider config, @beforeSave hashing, serialization guards
- `app/models/oauth_identity.ts` — OAuthIdentity model with belongsTo User
- `app/abilities/main.ts` — bouncer abilities scaffold (placeholder editUser ability)
- `app/middleware/initialize_bouncer_middleware.ts` — bouncer init middleware, API-only (no Edge view sharing)
- `.generated/policies.ts` — empty policies index for typecheck compatibility
- `package.json` — added ally, bouncer deps; #abilities/* and #generated/* import aliases
- `adonisrc.ts` — ally_provider, bouncer_provider, bouncer commands, indexPolicies hook
- `start/env.ts` — GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL
- `.env.example` — Google OAuth environment variables

## Decisions Made

- **No withAuthFinder mixin:** Kept User model clean using `DbAccessTokensProvider.forModel(User)` directly. The `withAuthFinder` mixin from scaffold adds `verifyCredentials()` but it requires the old `UserSchema` pattern. Auth v10's `tokensUserProvider` handles credential verification at the route level.
- **Removed scaffold files:** The scaffold-generated `app/controllers/` and `app/validators/user.ts` used the old `fullName`/`initials` user schema. They were deleted since proper feature controllers belong in `app/features/auth/` (per D-01) and will be created in plans 02-02 through 02-04.
- **Password nullable:** Users table `password` column is `nullable()` to support OAuth-only accounts and account deletion (PII overwrite sets password to null per D-17).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed bouncer middleware TypeScript errors from scaffold**
- **Found during:** Task 1 (installing bouncer — `node ace configure @adonisjs/bouncer` ran)
- **Issue:** Generated middleware referenced `#abilities/main` and `#generated/policies` aliases that didn't exist in package.json; also had `ctx.view` access (invalid for API-only app)
- **Fix:** Added `#abilities/*` and `#generated/*` import aliases to package.json; created `.generated/policies.ts` with empty export; rewrote middleware without Edge view sharing
- **Files modified:** `package.json`, `.generated/policies.ts`, `app/middleware/initialize_bouncer_middleware.ts`
- **Verification:** `pnpm typecheck` exits 0
- **Committed in:** `c2f64e9` (Task 1 commit)

**2. [Rule 1 - Bug] Replaced scaffold-generated controllers/validators/transformers**
- **Found during:** Task 3 (creating User model — old scaffold files used incompatible schema)
- **Issue:** `app/controllers/access_token_controller.ts` called `User.verifyCredentials()` (not available without withAuthFinder mixin); `app/controllers/new_account_controller.ts` used `fullName` field; `app/transformers/user_transformer.ts` used `fullName` and `initials` fields — all non-existent on new User model
- **Fix:** Deleted all 3 scaffold controllers, the user validator, and the user transformer; updated `.adonisjs/server/controllers.ts` (auto-generated artifact) to remove stale references
- **Files modified:** Deleted `app/controllers/access_token_controller.ts`, `app/controllers/new_account_controller.ts`, `app/controllers/profile_controller.ts`, `app/validators/user.ts`, `app/transformers/user_transformer.ts`; updated `.adonisjs/server/controllers.ts`
- **Verification:** `pnpm typecheck` exits 0
- **Committed in:** `4a3c49c` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bug fixes from scaffold-generated files)
**Impact on plan:** Both auto-fixes necessary for TypeScript to compile. Scaffold cleanup was expected given the major model schema change. No scope creep — deleted files will be replaced with proper feature-based implementations in plans 02-02 through 02-04.

## Issues Encountered

- `node ace configure @adonisjs/ally` is interactive in this environment — created `config/ally.ts` manually with the correct configuration (same result as the interactive configure would produce)
- `node ace migration:run` could not be verified in this environment (no .env file, no running database) — migrations were verified via TypeScript compilation and manual inspection of acceptance criteria

## User Setup Required

Google OAuth credentials must be configured before plans 02-04 (OAuth callback) can be tested:
- Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` to `.env`
- Configure callback URL in Google Cloud Console: `http://localhost:3333/auth/google/callback`

## Next Phase Readiness

- User model and migrations ready for plans 02-02 (registration), 02-03 (login), 02-04 (OAuth callback)
- `config/auth.ts` guard configuration in place — auth middleware already registered in kernel.ts
- `config/ally.ts` ready — Google OAuth driver configured
- No blockers for next plan

---
*Phase: 02-authentication-identity*
*Completed: 2026-03-27*
