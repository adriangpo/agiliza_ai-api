# Phase 2: Authentication & Identity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 02-authentication-identity
**Areas discussed:** Refresh token strategy, OAuth identity architecture, Social account linking, Account deletion depth, Password policy, Role model, Token abilities / scopes, Error response shape

---

## Refresh Token Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Long-lived tokens (90 days), no /auth/refresh | Tokens last 90 days, instantly revocable from DB. Mobile stays logged in without friction. Idiomatic for auth v10. | ✓ |
| Drop /auth/refresh, re-login on expiry | Shorter expiry, mobile re-calls POST /auth/login. Requires storing credentials client-side for silent re-auth. | |
| Build a custom /auth/refresh endpoint outside auth v10 | Custom refresh token table, fights framework conventions. | |

**User's choice:** 90-day tokens, AdonisJS way
**Notes:** User clarified understanding of the security model: 90-day opaque tokens are safe because they are instantly revocable from the DB. The risk of long-lived tokens (undetected theft window) is acceptable for a municipal citizen reporting app. User also requested session listing (`GET /auth/sessions`), revoke-specific-session (`DELETE /auth/sessions/:id`), and revoke-all (`DELETE /auth/sessions`) endpoints. User referenced "the basic" session management features common in security-conscious apps.

---

## OAuth Identity Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Separate oauth_identities table | Clean relational model. One row per provider per user. Adding providers later needs no schema changes. | ✓ |
| Columns on users table | google_id nullable column. Simpler now, requires migration per new provider. | |

**User's choice:** Separate oauth_identities table (recommended)
**Notes:** No additional clarification needed. Decision aligns with future-proofing for Apple OAuth (v2).

---

## Social Account Linking

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-link the accounts | Same email = same person. Add oauth_identities row to existing user. No friction. | ✓ |
| Reject with a clear error | Return 409, ask user to use password login. | |
| Create a separate account | Two distinct users with same email. Confusing UX. | |

**User's choice:** Auto-link (recommended)
**Notes:** No additional clarification needed.

---

## Account Deletion Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Soft delete + PII overwrite | Keep row for FK integrity. Overwrite email/display_name/password. Delete oauth_identities rows and all tokens. | ✓ |
| Hard delete the row | DELETE the users row. Requires CASCADE on all FKs. | |

**User's choice:** Soft delete + PII overwrite (recommended)
**Notes:** No additional clarification needed. The anonymized display_name was decided as "Deleted User" (English, per D-21 pattern established later in the discussion).

---

## Password Policy

| Option | Description | Selected |
|--------|-------------|----------|
| 8+ chars minimum, no complexity | Simple. Mobile-friendly. | |
| 8+ chars + at least 1 number | Light complexity. | |
| 8+ chars + uppercase + number + symbol | Strict. Mobile keyboard friction. | |

**User's choice:** 8+ chars + 1 uppercase + 1 number (no symbol) — typed as free text
**Notes:** User customized the option via the "Other" path. No symbol requirement to avoid mobile keyboard friction while still requiring meaningful complexity.

---

## Role Model

| Option | Description | Selected |
|--------|-------------|----------|
| Enum column on users, managers via seeder/migration | Simple. Role stored on user row. No self-registration as manager. | ✓ |
| Enum column, managers promoted via API endpoint | Same column, superadmin endpoint promotes citizens. | |
| Separate roles table with many-to-many | Supports multiple roles per user. Overkill for two roles. | |

**User's choice:** Enum column, managers via seeder/migration (recommended)
**Notes:** No additional clarification needed.

---

## Token Abilities / Scopes

| Option | Description | Selected |
|--------|-------------|----------|
| Wildcard (*) for all tokens | No ability checking. Bouncer handles all authorization. | |
| Role-based abilities (citizen vs. manager token) | Different ability arrays per role. Auth guard checks abilities. | ✓ |

**User's choice:** Role-based abilities
**Follow-up — Citizen abilities:**

| Option | Description | Selected |
|--------|-------------|----------|
| ['reports:write', 'reports:read', 'flags:write', 'profile:manage'] | Covers all citizen actions across phases. | ✓ |
| ['*'] for citizens, Bouncer enforces | Wildcard, no ability layer. | |

**Follow-up — Manager abilities:**

| Option | Description | Selected |
|--------|-------------|----------|
| ['*'] — full access | Managers can do everything. Bouncer still enforces business rules. | ✓ |
| Granular manager abilities | Explicit list per manager action. Requires maintenance as features are added. | |

**Notes:** Citizens get scoped abilities matching their role's feature surface. Managers get wildcard to avoid enumerating all management actions across 8 phases.

---

## Error Response Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Flat: { error: 'CODE', message: 'string' } | Machine-readable codes. | |
| Nested with field errors (VineJS format) | Field-level detail for all errors. | |
| Two-tier: VineJS for 422, generic for auth errors | Different shapes for different error types. | ✓ |

**User's choice:** Two-tier — but explicitly rejected machine-readable error codes (e.g., `EMAIL_ALREADY_EXISTS`) as an information disclosure/user enumeration risk. Auth errors use only generic messages.
**Notes:** User also established the project-wide pattern during this discussion: **all backend API responses are in English**. The frontend handles localization. This was added as decision D-21 in CONTEXT.md.

---

## Claude's Discretion

- Exact Bouncer policy file structure
- `@adonisjs/ally` callback handler implementation details
- Token `name` field value (device name from User-Agent)
- `display_name` max length validation (100 chars per Phase 1 D-25)
- Whether to store IP + User-Agent on token creation

## Deferred Ideas

- Apple OAuth — unmaintained v7 driver, defer to v2
- Password change endpoint — not Phase 2 scope
- Forgot password / password reset — not Phase 2 scope
- Two-factor authentication — not in SRS
- Rate limiting on auth endpoints — evaluate in Phase 3
