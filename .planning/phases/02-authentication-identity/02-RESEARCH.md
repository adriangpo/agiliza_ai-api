# Phase 2: Authentication & Identity - Research

**Researched:** 2026-03-24
**Domain:** AdonisJS v7 auth v10 opaque access tokens, @adonisjs/ally v6 social OAuth, VineJS validators, Bouncer authorization, multi-tenant user registration, token revocation, account deletion/anonymization
**Confidence:** HIGH (core auth APIs verified against official AdonisJS v7 docs; ally verified against official docs; package versions verified against npm registry)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

No Phase 2 CONTEXT.md exists yet. The following constraints are inherited from Phase 1 CONTEXT.md (locked decisions that Phase 2 code must comply with) plus the CLAUDE.md directives enforced project-wide.

### Locked Decisions (from Phase 1 CONTEXT.md)

- **D-01:** Feature code lives under `app/features/{name}/` — each feature folder contains: `controllers/`, `services/`, `validators/`, `policies/`, `routes.ts`, `tests/`, and is self-contained.
- **D-02:** Shared framework-level code lives in `app/shared/` — only base middleware, generic validators, DB provider setup, HTTP exceptions, and response helpers.
- **D-03:** Feature-specific tests live inside the feature folder at `app/features/{name}/tests/`. Japa config discovers them via glob: `app/features/**/*.spec.ts`.
- **D-04:** Cross-cutting tests (RLS contract tests, multi-feature integration tests) live in top-level `tests/` folder.
- **D-05:** Database migrations live in `database/migrations/`. Filenames are prefixed by feature: `002_auth_users.ts`, `003_auth_access_tokens.ts`, etc.
- **D-06:** Per-feature API documentation lives in `docs/features/{name}/API.md` and `docs/features/{name}/MODELS.md`.
- **D-07:** Two PostgreSQL roles: `migrator` (DDL + RLS policy owner) and `app` (DML only, RLS-restricted).
- **D-08:** `FORCE ROW LEVEL SECURITY` applied to all tenant-scoped tables. The `users` table IS tenant-scoped.
- **D-09:** `tenants` table uses UUID v7 PK. All other tables use `bigint` serial IDs. All tenant FK columns are `uuid` type.
- **D-10:** `TenantMiddleware` calls `set_config('app.tenant_id', tenantId, true)` (transaction-scoped) inside `db.transaction()`.
- **D-10a:** Authentication uses AdonisJS v7 `@adonisjs/auth` v10 opaque access tokens guard (DB-backed, instantly revocable). **JWT guard no longer exists in v7.** Tenant context is loaded from the authenticated user's DB record, not from a token payload claim.
- **D-11:** RLS policy pattern: `USING (tenant_id = current_setting('app.tenant_id', true)::uuid)`.
- **D-16:** Makefile is the single developer interface. All agents must use `make` targets.
- **D-17:** Makefile targets: `make up`, `make down`, `make test`, `make lint`, `make migrate`, `make dev`, `make build`, `make typecheck`.
- **D-18:** Separate test database. `NODE_ENV=test` → different DB name. Japa wraps each test in a transaction that rolls back.
- **D-22:** ESLint zero-warnings policy — `--max-warnings 0` always.
- **D-25:** Input character limits enforced at VineJS validator + DB column simultaneously.
- **D-26:** XSS rejection on write — VineJS rejects HTML/script content.
- **D-30:** All feature docs MUST include Mermaid diagrams (ER, sequence, state diagrams) in fenced ```mermaid``` blocks.

### Claude's Discretion (auth-specific, from Phase 1 CONTEXT.md)

- Token expiry duration (Phase 1 left this for Phase 2 to decide)
- Specific VineJS rules for password complexity
- Social account linking strategy (same email → merge accounts vs. separate)
- Whether to implement a `oauth_identities` linking table or store provider ID on the `users` table directly
- Role implementation strategy: `role` enum column on `users` vs. separate `roles` table

### Deferred Ideas (OUT OF SCOPE)

- Session-based auth (mobile clients require stateless tokens — D-10a)
- JWT guard (removed in auth v10 — D-10a)
- Actual push notification delivery (v2 concern)

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can register with unique email and password per tenant (RN-001) | Sections: Standard Stack, Architecture Patterns (Registration), Code Examples |
| AUTH-02 | User can authenticate via OAuth social login — Google; Apple if driver available (RN-001) | Sections: Standard Stack (Ally), Architecture Patterns (Social OAuth), Open Questions |
| AUTH-03 | User receives an opaque access token on login (AdonisJS v7 auth v10); tenant context loaded from user record per request — no JWT | Sections: Standard Stack (Auth), Architecture Patterns (Token Creation), Code Examples |
| AUTH-04 | Access tokens expire; user can obtain fresh token by re-authenticating | Sections: Architecture Patterns (Token Expiry Strategy), Don't Hand-Roll |
| AUTH-05 | Refresh tokens invalidated on logout; token blocklist in Redis | Sections: Architecture Patterns (Logout / Revocation), Code Examples |
| AUTH-06 | User's public profile exposes only display name and join date (RN-001) | Sections: Architecture Patterns (Profile Serialization) |
| AUTH-07 | User can delete account; personal data removed, publications anonymized to "Cidadão Anônimo" (RN-005) | Sections: Architecture Patterns (Account Deletion), Pitfalls |
| AUTH-08 | Deleted account tokens invalidated immediately via blocklist (RN-005) | Sections: Architecture Patterns (Token Revocation on Deletion) |

</phase_requirements>

---

## Summary

The critical insight for this phase is the **JWT vs. opaque token mismatch**: the ROADMAP and success criteria were authored when JWT was still under consideration, but CLAUDE.md (D-10a) locks in AdonisJS v7 `@adonisjs/auth` v10 opaque access tokens. This is not a problem — it simplifies the implementation. The ROADMAP's "refresh token" concept does not exist in auth v10's design philosophy. The official AdonisJS team explicitly states: "Refresh tokens is mainly a concept originated from JWT tokens. AdonisJS uses database backed tokens, hence there is no need to have refresh tokens at all." The success criteria item "POST /auth/refresh exchanges a valid refresh token" must be re-interpreted as **re-authentication via re-login** (`POST /auth/login` returns a new token; the old one remains valid until logout or expiry).

Token revocation (AUTH-05, AUTH-08) is simpler with opaque tokens than with JWT: `User.accessTokens.delete(user, tokenId)` immediately removes the token from `auth_access_tokens`, making it permanently invalid. There is no need for a Redis blocklist of valid tokens — the DB itself is the ground truth. However, the success criteria explicitly require a "Redis blocklist" for the `jti`. Since opaque tokens have no `jti` and the DB IS the blocklist, the plan should delete the token from the DB on logout rather than managing a parallel Redis blocklist. Redis can optionally be used to cache token invalidity for high-throughput scenarios, but this is premature optimization for Phase 2.

For Apple OAuth (AUTH-02), the official `@adonisjs/ally` v6 package does **not** include an Apple driver. Only GitHub, Google, Discord, LinkedIn, Facebook, Spotify, and Twitter are built-in. A third-party community package (`@bitkidd/adonis-ally-apple`) exists but was last updated in 2022 and shows zero npm adoption — its AdonisJS v7 compatibility is unconfirmed. The requirement says "Apple if driver available" — research concludes the driver is NOT reliably available for v7, so Phase 2 should implement Google OAuth and document Apple as a v2 item.

**Primary recommendation:** Use `@adonisjs/auth` v10 opaque access tokens with DB storage. Implement `POST /auth/register`, `POST /auth/login`, `POST /auth/logout` (deletes current token from DB), and `DELETE /users/me` (deletes all user tokens + anonymizes PII). Drop the refresh-token endpoint; re-authentication via `/auth/login` is the correct pattern. Implement Google OAuth via `@adonisjs/ally` v6. Skip Apple OAuth — document as deferred.

---

## Standard Stack

### Core (npm-verified 2026-03-24)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@adonisjs/auth` | `^10.0.0` | Opaque access tokens guard, DbAccessTokensProvider, user credential verification | Locked (D-10a) — no JWT, no alternatives |
| `@adonisjs/ally` | `^6.0.0` | OAuth2 social login (Google) | Official AdonisJS OAuth package, v7-compatible |
| `@vinejs/vine` | `^4.3.0` | Request validation (email, password, display name) | Ships with v7 scaffold, already installed |
| `@adonisjs/bouncer` | `^4.0.0` | Authorization policies (manager vs. citizen roles) | Official AdonisJS authorization, v7-compatible |
| `@adonisjs/lucid` | `^22.2.0` | ORM — User model, token relations, migrations | Already installed in Phase 1 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@adonisjs/redis` | `^10.0.0` | Redis client | Token-level caching if needed; already installed Phase 1 |
| `@japa/runner` | `^5.3.0` | Test runner | All tests |
| `@japa/api-client` | `^3.2.1` | HTTP assertion client | Functional endpoint tests |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DB-stored opaque tokens | Redis-stored tokens | Redis stores auto-expire but lose instant-query by ID; DB is simpler for Phase 2 scale |
| `@adonisjs/bouncer` policies | `role` enum column + middleware guard | Bouncer is AdonisJS-native; inline role checks in controllers create coupling |
| Google-only OAuth | Google + Apple | Apple driver not reliably available for v7 (last updated 2022, 0 npm installs) |
| Re-authentication for token refresh | Custom refresh token table | Auth v10 has no refresh token concept; custom implementation fights framework conventions |

### Installation

```bash
# auth and ally not yet added in Phase 1 — add them now
node ace add @adonisjs/auth   # select: access tokens guard + Lucid user provider
node ace add @adonisjs/ally   # select: google provider
node ace add @adonisjs/bouncer

# Or if already added during Phase 1 scaffold, verify config files exist:
# config/auth.ts, config/ally.ts
```

**Version verification (2026-03-24):**

```
@adonisjs/auth       → 10.0.0  (npm verified)
@adonisjs/ally       → 6.0.0   (npm verified)
@vinejs/vine         → 4.3.0   (npm verified)
@adonisjs/bouncer    → 4.0.0   (npm verified)
```

---

## Architecture Patterns

### Recommended Feature Structure

```
app/features/auth/
├── controllers/
│   ├── auth_controller.ts       # register, login, logout
│   └── social_auth_controller.ts # google redirect + callback
├── services/
│   ├── auth_service.ts          # credential verification, token creation
│   └── account_service.ts       # account deletion, PII anonymization
├── validators/
│   ├── register_validator.ts    # email, password, display_name
│   └── login_validator.ts       # email, password
├── policies/
│   └── user_policy.ts           # can delete own account, cannot delete others
├── routes.ts                    # /auth/* and /users/* routes
└── tests/
    ├── unit/
    │   ├── auth_service.spec.ts
    │   └── account_service.spec.ts
    └── functional/
        ├── register.spec.ts
        ├── login.spec.ts
        ├── logout.spec.ts
        ├── social_auth.spec.ts
        └── account_deletion.spec.ts

app/models/
└── user.ts                      # User Lucid model with accessTokens provider

database/migrations/
├── 002_auth_users.ts            # users table (tenant-scoped, RLS)
└── 003_auth_access_tokens.ts    # auth_access_tokens table

docs/features/auth/
├── API.md                       # All endpoints with Mermaid sequence diagrams
└── MODELS.md                    # User model ER diagram
```

### Pattern 1: User Model with Opaque Tokens

```typescript
// app/models/user.ts
// Source: https://docs.adonisjs.com/guides/auth/access-tokens-guard
import { DateTime } from 'luxon'
import { BaseModel, column, beforeSave } from '@adonisjs/lucid/orm'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import hash from '@adonisjs/core/services/hash'

export default class User extends BaseModel {
  static accessTokens = DbAccessTokensProvider.forModel(User, {
    expiresIn: '90 days',    // long-lived; instant revocation makes short expiry less critical
    prefix: 'oat_',
    table: 'auth_access_tokens',
    type: 'auth_token',
    tokenSecretLength: 40,
  })

  @column({ isPrimary: true })
  declare id: number            // bigint serial (D-09)

  @column()
  declare tenantId: string      // uuid — FK → tenants.id (D-09)

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string      // bcrypt hash — never serialized

  @column()
  declare displayName: string

  @column()
  declare role: 'citizen' | 'manager'

  @column()
  declare deletedAt: DateTime | null   // soft-delete for anonymization

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @beforeSave()
  static async hashPassword(user: User) {
    if (user.$dirty.password) {
      user.password = await hash.make(user.password)
    }
  }
}
```

**Key notes:**
- `serializeAs: null` on `password` prevents it from ever appearing in JSON responses
- `@beforeSave` hook hashes the password on create AND update
- `tenantId` is a `uuid` column (FK to tenants), not `bigint` (D-09)
- `deletedAt` enables soft-delete pattern for GDPR anonymization
- No `currentAccessToken` property defined on the model — it is injected at runtime by the auth guard after successful authentication

### Pattern 2: Database Migrations

```typescript
// database/migrations/002_auth_users.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table.string('email', 254).notNullable()
      table.string('password').notNullable()
      table.string('display_name', 100).notNullable()
      table.enum('role', ['citizen', 'manager']).notNullable().defaultTo('citizen')
      table.timestamp('deleted_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // Unique email per tenant (not globally)
      table.unique(['tenant_id', 'email'])
      table.index(['tenant_id'])
    })

    // RLS: only rows belonging to current tenant are visible (D-08, D-11)
    this.schema.raw(`ALTER TABLE users ENABLE ROW LEVEL SECURITY`)
    this.schema.raw(`ALTER TABLE users FORCE ROW LEVEL SECURITY`)
    this.schema.raw(`
      CREATE POLICY users_tenant_isolation ON users
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `)
    // Grant DML to app role only (no DDL)
    this.schema.raw(`GRANT SELECT, INSERT, UPDATE, DELETE ON users TO app`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

```typescript
// database/migrations/003_auth_access_tokens.ts
// Source: generated by `node ace add @adonisjs/auth` — customized for bigint users.id
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'auth_access_tokens'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').unsigned().primary()
      // IMPORTANT: users.id is bigint serial (D-09) — use bigInteger here, not integer
      table.bigInteger('tokenable_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE')
      table.string('type').notNullable()
      table.string('name').nullable()
      table.string('hash').notNullable().unique()
      table.text('abilities').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.timestamp('last_used_at').nullable()
      table.timestamp('expires_at').nullable()
    })
    // No RLS on auth_access_tokens — tokens are not tenant-scoped rows;
    // tenant isolation is enforced via the users join
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

**Critical:** The default `node ace add @adonisjs/auth` migration uses `table.integer('tokenable_id')` (32-bit). Since `users.id` is `bigIncrements` (bigint, 64-bit per D-09), the FK column must be `bigInteger`. If the default migration is used without modification, the FK will silently truncate large user IDs.

### Pattern 3: Token Creation on Login/Register

```typescript
// app/features/auth/controllers/auth_controller.ts
// Source: https://docs.adonisjs.com/guides/auth/access-tokens-guard
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'

export default class AuthController {
  async register({ request, response }: HttpContext) {
    const { email, password, displayName } = await request.validateUsing(registerValidator)

    // Duplicate email per tenant → 409 (unique constraint on [tenant_id, email])
    const user = await User.create({
      tenantId: /* from TenantMiddleware context */,
      email,
      password,            // hashed by @beforeSave hook
      displayName,
      role: 'citizen',
    })

    const token = await User.accessTokens.create(user, ['*'])
    return response.created({ token: token.value!.release(), user: user.serialize() })
  }

  async login({ request, response }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    // verifyCredentials throws E_INVALID_CREDENTIALS on wrong password
    // E_INVALID_CREDENTIALS maps to 400; wrap in try/catch and return 401
    const user = await User.verifyCredentials(email, password)

    const token = await User.accessTokens.create(user, ['*'])
    return response.ok({ token: token.value!.release(), user: user.serialize() })
  }

  async logout({ auth, response }: HttpContext) {
    // Deletes the current access token from auth_access_tokens — instant revocation
    await auth.use('api').invalidateToken()
    return response.ok({ message: 'Logged out' })
  }
}
```

**Note on `verifyCredentials`:** This method is provided by the Lucid user provider. It looks up the user by email AND verifies the password hash in one call. If credentials are invalid, it throws `E_INVALID_CREDENTIALS` (status 400 by default in AdonisJS). To return HTTP 401 as required, catch the exception and re-throw with 401.

**Note on tenant context:** `TenantMiddleware` (from Phase 1) sets `app.tenant_id` in the DB session. `User.create()` and `User.verifyCredentials()` run within that transaction context — RLS automatically filters to the correct tenant. The controller should NOT manually pass `tenantId` to validators; it is loaded from the DB session.

### Pattern 4: Tenant Context Loading on Authenticated Requests

Tenant context is NOT in the token payload (no JWT claims). It is loaded on every authenticated request from the user's DB record:

```typescript
// app/shared/middleware/tenant_middleware.ts (from Phase 1)
// The TenantMiddleware MUST run BEFORE auth.authenticate()
// Auth guard loads the user — the user record contains tenant_id
// After auth.authenticate(), auth.user!.tenantId is available
// TenantMiddleware then calls set_config('app.tenant_id', auth.user!.tenantId, true)
```

**Flow for authenticated routes:**
```
Request → TenantMiddleware (sets tenant_id from header/subdomain)
        → auth middleware (loads user, verifies token hash in DB)
        → Controller (auth.user!.tenantId available; RLS already active)
```

The `tenantId` must be resolvable BEFORE auth for the `users` lookup to work (RLS on `users` table requires tenant context to find the user). This creates a chicken-and-egg constraint: the tenant must be identified by something OTHER than the user token (e.g., subdomain, `X-Tenant-ID` header, or URL prefix). This is the established Phase 1 TenantMiddleware contract.

### Pattern 5: Google OAuth Flow

```typescript
// app/features/auth/controllers/social_auth_controller.ts
// Source: https://docs.adonisjs.com/guides/auth/social-authentication
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'

export default class SocialAuthController {
  async googleRedirect({ ally }: HttpContext) {
    // Stateless mode for mobile API clients (no cookies)
    return ally.use('google').stateless().redirect()
  }

  async googleCallback({ ally, response }: HttpContext) {
    const google = ally.use('google').stateless()

    if (google.accessDenied()) return response.unauthorized({ error: 'access_denied' })
    if (google.stateMisMatch()) return response.badRequest({ error: 'state_mismatch' })
    if (google.hasError()) return response.badRequest({ error: google.getError() })

    const googleUser = await google.user()

    // Find or create by (tenant_id, email) — RLS ensures tenant scope
    const user = await User.firstOrCreate(
      { email: googleUser.email!, tenantId: /* from tenant context */ },
      {
        email: googleUser.email!,
        displayName: googleUser.name ?? googleUser.nickName ?? 'User',
        password: crypto.randomUUID(), // unusable password for OAuth-only accounts
        role: 'citizen',
      }
    )

    const token = await User.accessTokens.create(user, ['*'])
    return response.ok({ token: token.value!.release(), user: user.serialize() })
  }
}
```

**Stateless mode:** Mobile app OAuth flows cannot set cookies. `.stateless()` disables the CSRF state cookie check. For a pure API (no browser redirect), the mobile app receives the `code` from the OAuth provider and sends it to the callback endpoint directly.

### Pattern 6: Account Deletion with PII Anonymization

```typescript
// app/features/auth/services/account_service.ts
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import Publication from '#models/publication'  // Phase 3+

export default class AccountService {
  async deleteAccount(user: User): Promise<void> {
    await db.transaction(async (trx) => {
      // 1. Invalidate ALL tokens for this user (AUTH-08)
      const tokens = await User.accessTokens.all(user)
      for (const token of tokens) {
        await User.accessTokens.delete(user, token.identifier)
      }

      // 2. Anonymize publications (Phase 3 model — guard with existence check)
      // await Publication.query({ client: trx })
      //   .where('userId', user.id)
      //   .update({ authorName: 'Cidadão Anônimo', userId: null })

      // 3. Anonymize user PII (soft delete — preserve audit trail)
      await user.useTransaction(trx).merge({
        email: `deleted_${user.id}@anonymous.invalid`,
        displayName: 'Cidadão Anônimo',
        password: await hash.make(crypto.randomUUID()),
        deletedAt: DateTime.now(),
      }).save()
    })
  }
}
```

### Pattern 7: VineJS Validators

```typescript
// app/features/auth/validators/register_validator.ts
import vine from '@vinejs/vine'

export const registerValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail().maxLength(254),
    password: vine.string().minLength(8).maxLength(128),
    displayName: vine.string().trim().minLength(2).maxLength(100)
      .escape(),  // XSS: rejects HTML/script content per D-26
  })
)

// app/features/auth/validators/login_validator.ts
export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail(),
    password: vine.string().minLength(1).maxLength(128),
  })
)
```

**Note on email uniqueness:** VineJS has a `.unique()` rule contributed by Lucid (requires database lookup). However, since the unique constraint is per-tenant (`[tenant_id, email]`), the built-in `.unique()` rule needs a `where` clause to check only the current tenant. The DB unique constraint itself will catch duplicates and throw an error that maps to HTTP 409. Validating at the VineJS layer too is optional but reduces round-trips.

### Pattern 8: Route Registration

```typescript
// app/features/auth/routes.ts
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AuthController = () => import('#features/auth/controllers/auth_controller')
const SocialAuthController = () => import('#features/auth/controllers/social_auth_controller')

router.group(() => {
  // Public routes (no auth required, but tenant context required)
  router.post('/auth/register', [AuthController, 'register'])
  router.post('/auth/login', [AuthController, 'login'])
  router.get('/auth/google/redirect', [SocialAuthController, 'googleRedirect'])
  router.get('/auth/google/callback', [SocialAuthController, 'googleCallback'])

  // Authenticated routes
  router.group(() => {
    router.post('/auth/logout', [AuthController, 'logout'])
    router.delete('/users/me', [UsersController, 'destroy'])
    router.get('/users/me', [UsersController, 'show'])
  }).use(middleware.auth({ guards: ['api'] }))

}).use(middleware.tenant())    // TenantMiddleware from Phase 1
```

### Anti-Patterns to Avoid

- **Using `auth.use('api').createToken(user)` without storing tenant context:** Tenant context is in the user record; you do not put it in the token. Never try to embed `tenantId` in a token name/ability field as a workaround.
- **Using `integer` for `tokenable_id` in the migration:** `users.id` is `bigIncrements` (64-bit). The FK column must be `bigInteger`.
- **Calling `User.verifyCredentials()` without tenant context active:** RLS on `users` requires the tenant_id DB session variable to be set. TenantMiddleware must run first.
- **Returning `token.value` after the request cycle ends:** `token.value!.release()` exposes the plain-text token only at creation time. Store it immediately; it cannot be retrieved from the DB afterward (only the hash is stored).
- **Implementing a refresh token endpoint:** Auth v10 has no refresh token concept. The correct pattern is long-lived tokens + re-authentication. The ROADMAP's success criteria for `POST /auth/refresh` does not apply to opaque tokens.
- **Using `hash.check()` manually for password verification:** Use `User.verifyCredentials()` — it handles timing-safe comparison and returns the user model in one call.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token hashing + storage | Custom token table + hash logic | `DbAccessTokensProvider` (auth v10) | Handles CRC checksum, hash storage, abilities, expiry, `last_used_at` tracking |
| Password hashing | Manual bcrypt calls | `@beforeSave` hook + `hash.make()` + `User.verifyCredentials()` | AdonisJS hash service handles algorithm config, timing safety, and lazy rehashing |
| Token revocation | Redis blocklist of token strings | `User.accessTokens.delete(user, tokenId)` + `auth.use('api').invalidateToken()` | DB IS the token store; deletion IS the revocation |
| OAuth state/CSRF | Custom state parameter generation | `.stateless()` or ally's built-in state cookie | ally handles PKCE-equivalent state management |
| Email normalization | Lowercase + trim manually | `vine.string().email().normalizeEmail()` | VineJS normalizeEmail handles case + dot notation |
| Role-based access | `if (user.role === 'manager')` in every controller | Bouncer policies | Centralized, testable, AdonisJS-idiomatic |

**Key insight:** AdonisJS auth v10 handles the entire token lifecycle. The token table is managed by the framework. Custom token infrastructure is never warranted.

---

## Common Pitfalls

### Pitfall 1: Refresh Token Misunderstanding

**What goes wrong:** Developer implements `POST /auth/refresh` using a custom "refresh token" stored in DB or Redis, following JWT tutorial patterns.
**Why it happens:** The ROADMAP success criteria mentions refresh tokens; JWT tutorials are the dominant pattern online.
**How to avoid:** Auth v10 has no refresh token concept. Opaque tokens are long-lived. On expiry, re-authenticate via `POST /auth/login`. Do not implement a refresh endpoint.
**Warning signs:** Any migration creating a `refresh_tokens` table; any code importing `jsonwebtoken` or `jose`.

### Pitfall 2: `tokenable_id` Type Mismatch

**What goes wrong:** The default `node ace add @adonisjs/auth` migration creates `tokenable_id` as `integer` (32-bit). If `users.id` is `bigIncrements` (64-bit), the FK definition fails or silently truncates at high ID values.
**Why it happens:** The default migration template assumes 32-bit user IDs; this project uses bigint (D-09).
**How to avoid:** After `node ace add @adonisjs/auth` generates the migration, IMMEDIATELY change `table.integer('tokenable_id')` to `table.bigInteger('tokenable_id')` before running migrations.
**Warning signs:** Migration fails with FK constraint type error; or passes silently with PostgreSQL implicit casting.

### Pitfall 3: RLS Chicken-and-Egg on Auth

**What goes wrong:** `User.verifyCredentials(email, password)` runs a DB query. If `app.tenant_id` is not set yet (TenantMiddleware hasn't run, or ran after auth middleware), the RLS policy on `users` returns no rows — authentication silently fails or returns "user not found" for valid credentials.
**Why it happens:** Middleware ordering in `start/kernel.ts` or the route group.
**How to avoid:** TenantMiddleware MUST be applied BEFORE the auth middleware in the pipeline. In route definitions, chain `.use(middleware.tenant())` before `.use(middleware.auth())`.
**Warning signs:** Valid credentials return HTTP 401; tests with explicit tenant context pass but e2e tests fail.

### Pitfall 4: `token.value!.release()` Called Too Late

**What goes wrong:** The plain-text token is only available at creation time via `token.value!.release()`. If the controller stores the `AccessToken` object and tries to call `.release()` outside the creation request, it returns `undefined`.
**Why it happens:** Treating the `AccessToken` object like a persistent value object.
**How to avoid:** Call `token.value!.release()` immediately in the same expression that returns the HTTP response. Never store the `AccessToken` object reference across requests.
**Warning signs:** Token value is `undefined` in response; tests show `null` token.

### Pitfall 5: `E_INVALID_CREDENTIALS` Status Code

**What goes wrong:** `User.verifyCredentials()` throws `E_INVALID_CREDENTIALS`, which AdonisJS maps to HTTP 400 by default. The requirement is HTTP 401.
**Why it happens:** AdonisJS error mapping convention; 400 is "bad request", but 401 is "unauthorized" for auth failures.
**How to avoid:** Catch `E_INVALID_CREDENTIALS` in the `login` controller and return `response.unauthorized()`. Or create a custom exception handler that maps this error to 401.
**Warning signs:** Login with wrong password returns 400, not 401.

### Pitfall 6: Apple OAuth Driver Incompatibility

**What goes wrong:** Developer installs `@bitkidd/adonis-ally-apple` (last updated 2022) and it fails to load with AdonisJS v7.
**Why it happens:** The package was built for AdonisJS v5/v6 and has not been updated for v7's ESM-first imports and changed Ally driver API.
**How to avoid:** Do not attempt Apple OAuth in Phase 2. Document as deferred. AUTH-02 explicitly says "Apple if driver available" — research concludes it is not reliably available for v7.
**Warning signs:** Import errors at startup; `ally.use('apple')` throwing runtime errors.

### Pitfall 7: Email Uniqueness — Per-Tenant vs. Global

**What goes wrong:** VineJS `.unique()` check is applied globally across ALL tenants, blocking a user from registering on Tenant B if they already registered on Tenant A with the same email.
**Why it happens:** The built-in VineJS unique rule uses `SELECT COUNT(*) WHERE email = ?` without filtering by tenant.
**How to avoid:** The DB unique constraint is `[tenant_id, email]` (not just `email`). The VineJS unique check must include `.where('tenant_id', currentTenantId)`, or skip the validator-level check entirely and let the DB constraint throw (catches the violation in the controller and returns 409).
**Warning signs:** User with `a@b.com` on Tenant A cannot register with `a@b.com` on Tenant B.

### Pitfall 8: `displayName` / PII Leakage in Token Responses

**What goes wrong:** `user.serialize()` returns fields including hashed `password` or internal `tenantId` that should not be in the public auth response.
**Why it happens:** Default Lucid serialization includes all columns unless explicitly excluded.
**How to avoid:** Use `serializeAs: null` on `password` (required), define a `$serialize()` override or a dedicated DTO for the public user shape that only exposes `displayName` and `createdAt` (AUTH-06).
**Warning signs:** API response body contains `password`, `tenantId`, `role`, or `deletedAt`.

---

## Code Examples

### Full Login Flow

```typescript
// Source: https://docs.adonisjs.com/guides/auth/access-tokens-guard
async login({ request, response }: HttpContext) {
  const { email, password } = await request.validateUsing(loginValidator)

  try {
    const user = await User.verifyCredentials(email, password)
    const token = await User.accessTokens.create(user, ['*'], {
      expiresIn: '90 days',
    })
    return response.ok({
      type: 'bearer',
      token: token.value!.release(),
      expiresAt: token.expiresAt,
    })
  } catch (error) {
    if (error.code === 'E_INVALID_CREDENTIALS') {
      return response.unauthorized({ error: 'Invalid email or password' })
    }
    throw error
  }
}
```

### Logout (Token Deletion)

```typescript
// Source: https://docs.adonisjs.com/guides/auth/access-tokens-guard
async logout({ auth, response }: HttpContext) {
  // invalidateToken() deletes the current token from auth_access_tokens
  // This is the "blocklist" — the token no longer exists in the DB
  await auth.use('api').invalidateToken()
  return response.ok({ message: 'Logged out successfully' })
}
```

### Bulk Token Revocation (Account Deletion)

```typescript
// Source: https://docs.adonisjs.com/guides/auth/access-tokens-guard
// Delete ALL tokens for a user (used on account deletion AUTH-08)
const tokens = await User.accessTokens.all(user)
for (const token of tokens) {
  await User.accessTokens.delete(user, token.identifier)
}
// Alternative: rely on CASCADE DELETE from users table if auth_access_tokens
// has onDelete('CASCADE') on tokenable_id — which the migration should set.
```

### Auth Middleware Configuration

```typescript
// config/auth.ts
// Source: https://docs.adonisjs.com/guides/auth/access-tokens-guard
import { tokensGuard, tokensUserProvider } from '@adonisjs/auth/access_tokens'
import { defineConfig } from '@adonisjs/auth'

export default defineConfig({
  default: 'api',
  guards: {
    api: tokensGuard({
      provider: tokensUserProvider({
        tokens: 'accessTokens',
        model: () => import('#models/user'),
      }),
    }),
  },
})
```

### Japa Functional Test Pattern

```typescript
// app/features/auth/tests/functional/register.spec.ts
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('POST /auth/register', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creates user and returns opaque token', async ({ client, assert }) => {
    const tenantId = '...'  // seeded in test setup
    const response = await client
      .post('/auth/register')
      .header('X-Tenant-ID', tenantId)
      .json({ email: 'user@example.com', password: 'secret1234', displayName: 'Test User' })

    response.assertStatus(201)
    response.assertBodyContains({ token: response.body().token })
    assert.isString(response.body().token)
    assert.match(response.body().token, /^oat_/)
  })

  test('returns 409 on duplicate email per tenant', async ({ client }) => {
    // ... register same email twice, assert second returns 409
  })

  test('returns 201 for same email on different tenant (cross-tenant isolation)', async ({ client }) => {
    // ... register same email on tenant A and tenant B, both succeed
  })
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JWT access + refresh tokens (v5/v6) | Opaque DB-backed tokens only (auth v10) | auth v10 / AdonisJS v7 | No `jti` field; no refresh endpoint; revocation is DB deletion |
| `@adonisjs/auth` v5/v6 API tokens guard | `DbAccessTokensProvider` with `accessTokens` static property | auth v9/v10 | Model configuration changed; `User.accessTokens.create()` replaces `auth.generate(user)` |
| Manual `verifyPassword` in controller | `User.verifyCredentials(email, password)` | auth v9/v10 | Built-in; throws typed exception; handles timing safety |
| `auth.attempt(email, password)` | `User.verifyCredentials()` + `User.accessTokens.create()` | auth v10 | Decoupled verification from token creation |

**Deprecated/outdated:**
- `auth.generate(user)`: v5 API. Replaced by `User.accessTokens.create(user, abilities)`.
- `auth.attempt(email, password)`: v5/v6 API. Replaced by `User.verifyCredentials()`.
- JWT guard (`@adonisjs/auth/guards/jwt`): Removed entirely in auth v10. No migration path within auth — if JWT is needed, use a separate library (but this project does not need it).

---

## Open Questions

1. **Refresh token success criterion interpretation**
   - What we know: The ROADMAP success criterion says "`POST /auth/refresh` exchanges a valid refresh token for a new access token; replaying the same refresh token returns HTTP 401." Auth v10 has no refresh token concept.
   - What's unclear: Does the product owner want a custom refresh token implementation, or is long-lived opaque token + re-login acceptable?
   - Recommendation: Drop `POST /auth/refresh`. Replace with documentation note explaining that opaque tokens are long-lived and re-authentication via `POST /auth/login` is the correct pattern. Update the ROADMAP success criteria before Phase 2 planning begins.

2. **Apple OAuth driver for AdonisJS v7**
   - What we know: `@adonisjs/ally` v6 has no built-in Apple driver. The community package `@bitkidd/adonis-ally-apple` was last updated April 2022 (pre-v7) with 0 npm installs.
   - What's unclear: Whether a maintained v7-compatible Apple driver exists or has been published since.
   - Recommendation: Implement Google OAuth only in Phase 2. Create a placeholder in the OAuth controller for Apple with a TODO comment. Document Apple as a Phase 3 or v2 enhancement. AUTH-02 says "Apple if driver available" — it is not.

3. **Tenant identification mechanism for auth routes**
   - What we know: RLS on `users` requires `app.tenant_id` to be set before `User.verifyCredentials()` runs. The TenantMiddleware from Phase 1 sets this. But TenantMiddleware must know which tenant it is before the user is authenticated.
   - What's unclear: The Phase 1 plans show TenantMiddleware but do not specify HOW the tenant is identified (subdomain? `X-Tenant-ID` header? route prefix?). This must be established before auth routes can work.
   - Recommendation: Confirm the tenant identification strategy from Phase 1 implementation. The plan should include a step to verify TenantMiddleware integration with the auth routes.

4. **Social OAuth account linking strategy**
   - What we know: A user with email `a@b.com` could register via email/password AND via Google OAuth, potentially creating two accounts.
   - What's unclear: Does the system merge accounts (same email = same user regardless of auth method) or treat them as separate?
   - Recommendation: Use `User.firstOrCreate({ email, tenantId })` in the OAuth callback — same email = same user within the same tenant. This is the simplest strategy and prevents duplicate accounts.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js 24+ | AdonisJS v7 | PARTIAL | v22.22.0 | **Blocker** — AdonisJS v7 requires Node.js 24; v22 is installed |
| PostgreSQL | User DB, migrations | Available | (local pg_isready OK) | — |
| Redis | Token store (optional), rate limiting | NOT available (no local service) | — | Docker Compose (D-15) `make up` starts Redis |
| Docker | `make up` (Compose) | Available | 29.3.0 | — |
| Docker Compose | `make up` | Available | v5.1.1 | — |

**CRITICAL — Node.js version:** `node --version` returns `v22.22.0`. AdonisJS v7 requires Node.js 24. This is a pre-existing environment issue that Phase 1 should have addressed. Phase 2 plans must assume the developer runs `make up` (Docker) or has a Node.js 24 environment before executing.

**Redis:** Not installed locally. Available via Docker Compose (`make up`). All test infrastructure should use Sync adapter (not Redis adapter) per Phase 1 decisions (D-18, INFRA-08).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Japa `@japa/runner` v5.3.0 + `@japa/plugin-adonisjs` v5.2.0 |
| Config file | `japa.config.ts` (configured in Phase 1) |
| Quick run command | `node ace test --groups=unit` |
| Full suite command | `node ace test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | `POST /auth/register` creates user + returns token; duplicate → 409 | functional | `node ace test --files=**/auth/tests/functional/register.spec.ts` | Wave 0 |
| AUTH-02 | Google OAuth redirect + callback creates/finds user + returns token | functional | `node ace test --files=**/auth/tests/functional/social_auth.spec.ts` | Wave 0 |
| AUTH-03 | Token is opaque (starts with `oat_`), DB-backed, no JWT claims | unit | `node ace test --files=**/auth/tests/unit/auth_service.spec.ts` | Wave 0 |
| AUTH-04 | Token expires; expired token returns 401 on authenticated route | functional | `node ace test --files=**/auth/tests/functional/login.spec.ts` | Wave 0 |
| AUTH-05 | `POST /auth/logout` deletes token from DB; same token → 401 | functional | `node ace test --files=**/auth/tests/functional/logout.spec.ts` | Wave 0 |
| AUTH-06 | `GET /users/me` returns only displayName + createdAt (no password, no tenantId) | functional | included in `login.spec.ts` | Wave 0 |
| AUTH-07 | `DELETE /users/me` anonymizes PII; publications show "Cidadão Anônimo" | functional | `node ace test --files=**/auth/tests/functional/account_deletion.spec.ts` | Wave 0 |
| AUTH-08 | After account deletion, all previous tokens → 401 | functional | included in `account_deletion.spec.ts` | Wave 0 |

**Cross-tenant isolation test (always required per D-04):**
- Same email registers on Tenant A and Tenant B independently → both succeed (no 409 across tenants)
- Token from Tenant A user cannot access Tenant B user's `GET /users/me` → 401 or 404

### Sampling Rate

- **Per task commit:** `node ace test --groups=unit`
- **Per wave merge:** `node ace test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

All test files need to be created before implementation:

- [ ] `app/features/auth/tests/functional/register.spec.ts` — covers AUTH-01
- [ ] `app/features/auth/tests/functional/login.spec.ts` — covers AUTH-03, AUTH-04, AUTH-06
- [ ] `app/features/auth/tests/functional/logout.spec.ts` — covers AUTH-05
- [ ] `app/features/auth/tests/functional/social_auth.spec.ts` — covers AUTH-02
- [ ] `app/features/auth/tests/functional/account_deletion.spec.ts` — covers AUTH-07, AUTH-08
- [ ] `app/features/auth/tests/unit/auth_service.spec.ts` — covers AUTH-03 unit
- [ ] `app/features/auth/tests/unit/account_service.spec.ts` — covers AUTH-07 unit
- [ ] `tests/rls/auth_tenant_isolation.spec.ts` — cross-tenant leak tests (D-04)

---

## Project Constraints (from CLAUDE.md)

Directives extracted from CLAUDE.md that the planner must verify compliance with:

| Directive | Enforcement |
|-----------|-------------|
| AdonisJS v7 + Node.js 24 | All scaffold and package choices must be v7-compatible |
| TDD — tests written first | Wave 0 creates ALL test files before implementation waves |
| RLS tenant isolation tested | `tests/rls/auth_tenant_isolation.spec.ts` required; cross-tenant leak = CI failure |
| No file does too much | `AuthController`, `AccountService`, `AuthService`, `RegisterValidator`, `LoginValidator`, `UserPolicy` are SEPARATE files |
| ESLint + Prettier, CI fails on lint | `make lint` must pass; `--max-warnings 0` enforced |
| Latest stable versions | Versions verified against npm registry 2026-03-24 |
| `@adonisjs/validator` forbidden | Use `@vinejs/vine` only — it is already installed |
| `jsonwebtoken` / `jose` forbidden | No JWT; opaque tokens only (auth v10) |
| `passport` forbidden | Use `@adonisjs/auth` + `@adonisjs/ally` only |
| `jest` / `vitest` forbidden | Use Japa only |
| `prisma` / `drizzle` / `sequelize` forbidden | Use Lucid only |
| Session-based auth forbidden | Mobile clients require stateless opaque tokens |
| In-memory rate limiting forbidden | Redis-backed only (applies from Phase 3; noted here for awareness) |
| `.eslintrc.json` format forbidden | Use `eslint.config.ts` flat config (v10) |
| `husky` / `simple-git-hooks` forbidden | Use `lefthook` only (D-19) |
| Input character limits at VineJS + DB | `email` maxLength(254), `displayName` maxLength(100), `password` maxLength(128) — enforced at both layers |
| XSS rejection on write | `displayName` validator uses `.escape()` or rejects HTML tags |
| Docs in same commit as code | `docs/features/auth/API.md` and `docs/features/auth/MODELS.md` created with Mermaid diagrams in same commit as feature code |
| Makefile as single interface | Plans use `make test`, `make lint`, `make migrate` — never raw commands |

---

## Sources

### Primary (HIGH confidence)

- [AdonisJS Access Tokens Guard](https://docs.adonisjs.com/guides/auth/access-tokens-guard) — token creation, deletion, User model setup, guard config
- [AdonisJS Social Authentication](https://docs.adonisjs.com/guides/auth/social-authentication) — ally OAuth flow, Google driver, stateless mode, user() response shape
- [AdonisJS Auth Introduction](https://docs.adonisjs.com/guides/auth/introduction) — guards overview, opaque vs JWT distinction
- npm registry (2026-03-24) — @adonisjs/auth@10.0.0, @adonisjs/ally@6.0.0, @vinejs/vine@4.3.0, @adonisjs/bouncer@4.0.0

### Secondary (MEDIUM confidence)

- [AdonisJS Discussions #2039 — Refresh Tokens](https://github.com/orgs/adonisjs/discussions/2039) — official AdonisJS team position: refresh tokens are unnecessary with opaque tokens
- [AdonisJS v7 auth introduction (GitHub source)](https://github.com/adonisjs/v7-docs/blob/main/content/guides/auth/introduction.md) — guard list, opaque vs JWT philosophy
- Phase 1 RESEARCH.md (this project) — `auth_access_tokens` table schema, bigint FK concern, `@beforeSave` hook pattern

### Tertiary (LOW confidence — flag for validation)

- [ally-apple package page](https://packages.adonisjs.com/packages/ally-apple) — Apple OAuth community driver; last update 2022; v7 compatibility unconfirmed
- WebSearch results confirming `deleteAll()` bulk token cleanup in v7 — needs official docs verification before use in plans

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions npm-verified; auth v10 and ally v6 are the official v7 packages
- Architecture: HIGH — token creation/deletion patterns verified from official docs; tenant context pattern verified from Phase 1 CONTEXT.md
- Pitfalls: HIGH — tokenable_id type mismatch and refresh token misunderstanding are confirmed based on official schema and official team statements
- Apple OAuth: LOW — no confirmed v7-compatible Apple driver found

**Research date:** 2026-03-24
**Valid until:** 2026-06-24 (90 days; AdonisJS auth is stable; ally driver list changes slowly)
