---
phase: 2
slug: authentication-identity
status: approved
reviewed_at: 2026-03-24
shadcn_initialized: false
preset: none
created: 2026-03-24
---

# Phase 2 — UI Design Contract: Authentication & Identity

> Visual and interaction contract for Phase 2. This project is a pure backend REST API (AdonisJS v7) with no frontend framework. "UI" in this context means the API interaction contract: JSON response shapes, HTTP status semantics, error message copy, and field naming conventions. Consumed by gsd-planner and gsd-executor as the source of truth for response design.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | not applicable — REST API, no UI components |
| Icon library | not applicable |
| Font | not applicable |

**Rationale:** This project has no `components.json`, no `tailwind.config`, no frontend framework, and no `src/` directory. The shadcn gate does not apply. The "design system" for this API is the JSON contract described in the sections below.

---

## Spacing Scale

Not applicable — no visual layout. The API interaction equivalent (field ordering) is defined in the Response Shapes section.

---

## Typography

Not applicable — no visual typography. Error message tone and structure are defined in the Copywriting Contract.

---

## Color

Not applicable — no visual color. HTTP status code semantics serve as the equivalent signal layer:

| Signal | HTTP Status | Meaning |
|--------|-------------|---------|
| Success | 200 | Resource returned |
| Created | 201 | Resource created (register, token issued) |
| No Content | 204 | Action completed, no body (logout) |
| Bad Request | 400 | Malformed request body |
| Unauthorized | 401 | Invalid or missing token |
| Conflict | 409 | Duplicate resource (email already registered in tenant) |
| Unprocessable | 422 | Validation failure (VineJS rejection) |
| Too Many Requests | 429 | Rate limit exceeded |

---

## API Interaction Contract

This section replaces the visual design contract for a backend-only phase.

### Endpoint Inventory

| Method | Path | Auth Required | Requirement |
|--------|------|---------------|-------------|
| POST | /auth/register | No | AUTH-01 |
| POST | /auth/login | No | AUTH-01 |
| POST | /auth/logout | Yes (token) | AUTH-05 |
| GET | /auth/google/redirect | No | AUTH-02 |
| GET | /auth/google/callback | No | AUTH-02 |
| GET | /users/me | Yes (token) | AUTH-06 |
| DELETE | /users/me | Yes (token) | AUTH-07, AUTH-08 |

### Response Shape: Auth Token (register + login)

Returned on `POST /auth/register` (HTTP 201) and `POST /auth/login` (HTTP 200).

```json
{
  "token": {
    "type": "bearer",
    "value": "oat_<40-char-secret>"
  },
  "user": {
    "id": 1,
    "displayName": "Maria Silva",
    "joinedAt": "2026-03-24T00:00:00.000Z"
  }
}
```

**Field contract:**
- `token.type` is always the string `"bearer"` — never `"Bearer"` (lowercase)
- `token.value` always begins with the prefix `oat_` (set in `DbAccessTokensProvider` config)
- `user.id` is a bigint serialized as a JSON number
- `user.displayName` is the public-safe name — never email, never role
- `user.joinedAt` is ISO 8601 UTC — never `createdAt` in the response key name
- `user.email` is NOT present — public profile exposes display name and join date only (AUTH-06)
- `user.role` is NOT present — role is internal, not part of the public token response
- `user.password` is NOT present — `serializeAs: null` enforces this at model level

### Response Shape: Public Profile (GET /users/me)

Returned on `GET /users/me` (HTTP 200).

```json
{
  "user": {
    "id": 1,
    "displayName": "Maria Silva",
    "joinedAt": "2026-03-24T00:00:00.000Z"
  }
}
```

**Field contract:**
- Identical field set to the `user` object in the token response
- No email, no role, no tenant ID — public profile only (RN-001, AUTH-06)

### Response Shape: Logout (POST /auth/logout)

Returned on `POST /auth/logout` (HTTP 204). No response body.

**Behavior contract:**
- The current opaque token is deleted from `auth_access_tokens` table immediately
- Subsequent requests with the same token value return HTTP 401
- No Redis blocklist needed — DB deletion is the revocation mechanism

### Response Shape: Account Deletion (DELETE /users/me)

Returned on `DELETE /users/me` (HTTP 204). No response body.

**Behavior contract:**
- All personal data removed: `email` set to `deleted-{id}@anonymized.invalid`, `password` hash cleared
- `display_name` set to `"Cidadão Anônimo"` (AUTH-07, RN-005) — exact string, no variation
- `deleted_at` timestamp populated (soft delete)
- All tokens for this user deleted from `auth_access_tokens` immediately (AUTH-08)
- Cross-tenant: only tokens belonging to the authenticated user are deleted

### Response Shape: Validation Error (HTTP 422)

```json
{
  "errors": [
    {
      "field": "email",
      "message": "O campo e-mail é obrigatório.",
      "rule": "required"
    }
  ]
}
```

**Field contract:**
- `errors` is always an array — never a single object
- `field` matches the request body field name exactly (camelCase in JSON, snake_case in DB)
- `message` is in Portuguese (pt-BR) — see Copywriting Contract below
- `rule` is the VineJS rule name for machine-readable error handling by clients

### Response Shape: Conflict Error (HTTP 409)

```json
{
  "message": "Este e-mail já está registrado neste município."
}
```

### Response Shape: Unauthorized (HTTP 401)

```json
{
  "message": "Token inválido ou expirado."
}
```

### Response Shape: Social OAuth (Google)

`GET /auth/google/redirect` — redirects to Google (no JSON body).

`GET /auth/google/callback` — after successful OAuth, returns the same token shape as login (HTTP 200):

```json
{
  "token": {
    "type": "bearer",
    "value": "oat_<40-char-secret>"
  },
  "user": {
    "id": 1,
    "displayName": "Maria Silva",
    "joinedAt": "2026-03-24T00:00:00.000Z"
  }
}
```

**Social account linking contract:**
- If an existing user in the tenant has the same email as the Google account, link to that user and return their token (merge strategy — not a new account)
- If no existing user, create a new user with `role: 'citizen'` and a randomly generated password hash (user has no password — OAuth only)
- Apple OAuth is deferred to v2 (driver not reliably available for AdonisJS v7 — RESEARCH.md finding)

---

## Copywriting Contract

All user-facing copy is in **Brazilian Portuguese (pt-BR)**. Error messages are prescriptive: they state the problem and the path to resolution.

| Element | Copy (pt-BR) |
|---------|--------------|
| Register CTA | "Criar conta" |
| Login CTA | "Entrar" |
| Logout CTA | "Sair" |
| Delete account CTA | "Excluir minha conta" |
| Empty state: no user session | "Faça login para continuar." |
| Error: invalid credentials | "E-mail ou senha incorretos. Verifique suas credenciais e tente novamente." |
| Error: email already registered | "Este e-mail já está registrado neste município. Faça login ou use outro e-mail." |
| Error: token invalid or expired | "Token inválido ou expirado. Faça login novamente." |
| Error: required field missing | "O campo {field} é obrigatório." |
| Error: email format invalid | "Informe um e-mail válido." |
| Error: password too short | "A senha deve ter no mínimo 8 caracteres." |
| Destructive: account deletion confirmation | Body: "Sua conta e todos os seus dados serão removidos permanentemente. Suas publicações serão atribuídas a 'Cidadão Anônimo'. Esta ação não pode ser desfeita." |
| Anonymized display name | "Cidadão Anônimo" (exact string — no variation, RN-005, AUTH-07) |

**Destructive action contract — DELETE /users/me:**
- No interactive confirmation dialog exists at the API layer
- Confirmation is a client-side concern; the API requires only a valid authenticated token
- The endpoint is idempotent: a second DELETE on an already-deleted account returns HTTP 404

**Note on "Cidadão Anônimo":** The string `"Cidadão Anônimo"` is a locked business requirement (RN-005). It must be stored exactly as-is in the `display_name` column. Do not normalize to ASCII, trim accents, or localize.

---

## Request Validation Contract

Defines the VineJS schema constraints that drive both API rejection copy and DB column sizes (D-25).

| Field | Rule | Limit | Error Message |
|-------|------|-------|---------------|
| `email` | format: email | 254 chars | "Informe um e-mail válido." |
| `password` | minLength | 8 chars | "A senha deve ter no mínimo 8 caracteres." |
| `password` | maxLength | 72 chars | "A senha pode ter no máximo 72 caracteres." |
| `displayName` | required | — | "O campo nome é obrigatório." |
| `displayName` | minLength | 2 chars | "O nome deve ter no mínimo 2 caracteres." |
| `displayName` | maxLength | 100 chars | "O nome pode ter no máximo 100 caracteres." |
| Any field | XSS rejection | — | "Conteúdo inválido detectado no campo {field}." (D-26) |

**Password complexity:** No character class requirements for v1 (length-only rule). This is within Claude's discretion (RESEARCH.md) — complexity rules create friction on mobile and are not required by the SRS.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable — no frontend |
| third-party | none | not applicable — no frontend |

No frontend component registry applies to this phase.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
