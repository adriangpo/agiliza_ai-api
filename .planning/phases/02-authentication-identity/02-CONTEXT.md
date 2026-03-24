# Phase 2: Authentication & Identity - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

User registration (email/password), authentication (email/password + Google OAuth), opaque access token lifecycle (issue, list sessions, revoke one, revoke all), account deletion with PII anonymization — all scoped per tenant. No frontend. This phase delivers the auth feature only; authorization policies for other features are enforced in their respective phases.

</domain>

<decisions>
## Implementation Decisions

### Token Lifecycle

- **D-01:** Use AdonisJS v7 `@adonisjs/auth` v10 opaque access tokens (DB-backed). No JWT. No refresh token endpoint — auth v10 has no such concept and the AdonisJS team explicitly states it is unnecessary.
- **D-02:** Token expiry: `90 days`. Tokens are instantly revocable from the DB, so long-lived tokens are safe for mobile clients without a refresh mechanism.
- **D-03:** On `POST /auth/logout` — delete the **current** token from `auth_access_tokens`. On `DELETE /auth/sessions` — delete **all** tokens for the user (logout all devices). On `DELETE /auth/sessions/:id` — delete a specific token by ID.
- **D-04:** `GET /auth/sessions` returns all active tokens for the authenticated user with metadata: token ID, created_at, last_used_at, IP address (if available), user agent (if available). This is the session listing endpoint.
- **D-05:** On password change (if implemented later) — revoke all tokens immediately as a security measure.

### OAuth Identity Architecture

- **D-06:** OAuth provider data is stored in a separate `oauth_identities` table (not as columns on `users`). Schema: `id`, `user_id` (FK → users.id), `provider` (enum: `google`; extensible for future providers), `provider_user_id`, `provider_email`, `created_at`, `updated_at`.
- **D-07:** Apple OAuth is **deferred** — `@adonisjs/ally` v6 has no Apple driver; the only third-party option is unmaintained (last updated 2022, 0 installs). Document as v2 item.

### Social Account Linking

- **D-08:** When a Google OAuth callback returns an email that already exists in the tenant's `users` table — **auto-link**: create a new row in `oauth_identities` linking Google to the existing user. No error, no friction. The user can now log in with either method.
- **D-09:** When a Google OAuth callback returns an email that does NOT exist — create a new `users` row (role: `citizen`) and a new `oauth_identities` row in one transaction.

### Role Model

- **D-10:** `role` is a `VARCHAR(20)` enum column on the `users` table with values `citizen` and `manager`. Default: `citizen`.
- **D-11:** `POST /auth/register` always creates `citizen` accounts. Manager accounts are created only via database seeders or a protected admin endpoint — never via public registration.
- **D-12:** Bouncer policies enforce role-based authorization across all features. The `role` column is the single source of truth.

### Token Abilities

- **D-13:** Citizen tokens are issued with abilities: `['reports:write', 'reports:read', 'flags:write', 'profile:manage']`.
- **D-14:** Manager tokens are issued with abilities: `['*']` (full access). Bouncer policies still enforce manager-specific business rules on top.
- **D-15:** The auth guard checks token abilities before reaching the controller. Routes that require manager-only access verify the `*` ability.

### Password Policy

- **D-16:** VineJS enforces at registration: minimum 8 characters, at least 1 uppercase letter, at least 1 digit. No symbol requirement. DB column: `VARCHAR(255)` (stores bcrypt hash).

### Account Deletion

- **D-17:** `DELETE /users/me` performs a soft delete + PII overwrite in a single transaction:
  1. `email` → `deleted_{userId}@deleted.invalid`
  2. `display_name` → `Deleted User`
  3. `password` → null (or a random unhashable garbage value)
  4. `deleted_at` → current timestamp
  5. All rows in `oauth_identities` for this user → hard deleted
  6. All rows in `auth_access_tokens` for this user → hard deleted (AUTH-08)
  7. All publications by this user → `display_name` set to `Deleted User` (anonymized, not deleted)
- **D-18:** The `users` row is kept to preserve FK integrity (publications, audit logs, etc.). PII is gone; the row is a tombstone.

### Error Response Shape

- **D-19:** Two-tier error handling. All API responses use **English** for field names, messages, and status strings. The frontend handles localization.
  - **422 Validation errors** — VineJS native format:
    ```json
    {
      "errors": [
        { "field": "email", "message": "The email field must be a valid email address", "rule": "email" },
        { "field": "password", "message": "The password field must have at least 8 characters", "rule": "minLength" }
      ]
    }
    ```
  - **401 / 403 / 409 Auth and business errors** — generic message only. **No machine-readable error codes that reveal internal state** (prevents user enumeration):
    ```json
    { "message": "Invalid credentials" }
    ```
    ```json
    { "message": "Unauthorized" }
    ```
    ```json
    { "message": "An account with this email already exists" }
    ```
    Note: 409 on duplicate registration is acceptable — it reveals that the email exists in the tenant, but this is a deliberate UX trade-off (better than silent failure). Auth errors (wrong password, expired token) always use generic messages.
- **D-20:** `API.md` for the auth feature MUST explicitly document each endpoint's possible HTTP status codes, which error shape applies (validation vs. generic), and example payloads for both success and error cases.

### API Response Language

- **D-21:** **All backend API responses are in English** — field names, error messages, enum values, status strings. This is a project-wide convention established in Phase 2. The frontend is responsible for localization/translation.

### Claude's Discretion

- Exact Bouncer policy file structure for the auth feature
- `@adonisjs/ally` callback handler implementation details (state param, CSRF protection)
- Token `name` field value on the `auth_access_tokens` table (e.g., device name from User-Agent header)
- Exact `display_name` validation rules (max length is 100 per D-25 from Phase 1)
- Whether to store IP + User-Agent on token creation for the session listing endpoint (recommended: yes)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements
- `.planning/REQUIREMENTS.md` §Authentication & Identity — AUTH-01 through AUTH-08 requirements
- `.planning/PROJECT.md` §Key Decisions — D-10a (opaque tokens locked), JWT+OAuth decision rationale

### Phase Context
- `.planning/phases/01-foundation/01-CONTEXT.md` — All D-01 through D-30 decisions that Phase 2 code must comply with (folder structure, RLS patterns, Makefile, ESLint, Mermaid docs, etc.)

### Research
- `.planning/phases/02-authentication-identity/02-RESEARCH.md` — Verified AdonisJS v7 auth v10 patterns, `@adonisjs/ally` v6 OAuth flow, migration schemas, code examples for User model, token creation, logout, account deletion

### UI/API Contract
- `.planning/phases/02-authentication-identity/02-UI-SPEC.md` — HTTP status semantics, response shape conventions, endpoint definitions for this phase

### Roadmap
- `.planning/ROADMAP.md` §Phase 2 — Success criteria (note: success criteria #3 referencing "refresh token" is superseded by D-01; re-authentication via POST /auth/login is the correct interpretation)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — Phase 1 not yet executed. Codebase is greenfield.

### Established Patterns
- All patterns come from Phase 1 CONTEXT.md decisions (D-01 through D-30). Phase 2 is the first feature phase to apply them.
- `TenantMiddleware` from Phase 1 will be available — auth routes need it to scope user lookup to the correct tenant.
- `app/shared/middleware/` will have the reusable `RateLimit` middleware from Phase 1 (Phase 2 may not need rate limiting on auth endpoints, but the infrastructure is there).

### Integration Points
- `database/migrations/002_auth_users.ts` — users table with RLS
- `database/migrations/003_auth_access_tokens.ts` — auth_access_tokens table
- `database/migrations/004_auth_oauth_identities.ts` — oauth_identities table (new, Phase 2 specific)
- `app/features/auth/` — self-contained feature folder per D-01
- `app/models/user.ts` — User Lucid model (lives in `app/models/` per research recommendation)

</code_context>

<specifics>
## Specific Ideas

- Session listing endpoint (`GET /auth/sessions`) should return enough metadata for a user to recognize their devices: created_at, last_used_at, IP address, user agent string.
- The `oauth_identities` table design must accommodate future providers (Apple, Facebook) without schema changes — just new rows with a different `provider` value.
- The ROADMAP success criteria mention "refresh token" and "jti" — these are JWT artifacts. Downstream agents must interpret these as: refresh = re-login, jti = opaque token ID in `auth_access_tokens.id`, blocklist = DB deletion.
- Frontend security documentation (in `docs/features/auth/API.md`) must include a section on client-side token handling: store in OS secure storage (iOS Keychain / Android Keystore), never in localStorage or cookies, transmit only over HTTPS via Authorization header.

</specifics>

<deferred>
## Deferred Ideas

- Apple OAuth — `@adonisjs/ally` v6 has no Apple driver; community package is unmaintained. Revisit in v2.
- Password change endpoint — not in Phase 2 scope; when added, must revoke all tokens.
- "Forgot password" / password reset flow — not in Phase 2 scope.
- Two-factor authentication (2FA) — not in SRS; out of scope for v1.
- Rate limiting on auth endpoints — not explicitly required for Phase 2; will be evaluated when Phase 3 establishes the rate limiting patterns (RNF-08).

</deferred>

---

*Phase: 02-authentication-identity*
*Context gathered: 2026-03-24*
