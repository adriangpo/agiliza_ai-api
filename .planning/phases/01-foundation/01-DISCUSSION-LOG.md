# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 01-foundation
**Areas discussed:** Feature folder layout, CI/CD platform, Dev environment, Pre-commit tooling, Security

---

## Feature Folder Layout

| Option | Description | Selected |
|--------|-------------|----------|
| `app/features/{name}/` | Feature folders under app/features/, controllers/services/validators/policies/routes.ts/tests/ | ✓ |
| `app/{name}/` per feature | Directly under app/, closer to AdonisJS defaults | |
| `src/features/{name}/` | Outside app/ folder | |

**Test location:**
| Option | Selected |
|--------|----------|
| Feature tests inside `app/features/{name}/tests/` + cross-cutting in `tests/` | ✓ |
| All in top-level `tests/` | |
| All inside feature folders | |

**Docs location:**
| Option | Selected |
|--------|----------|
| Top-level `docs/features/{name}/` | ✓ |
| Inside feature folder | |
| Both | |

**Shared code:** Claude's discretion — strict: only framework-level shared utilities, not domain logic.

**Migrations:**
| Option | Selected |
|--------|----------|
| `database/migrations/` with feature-prefixed filenames | ✓ |
| Central without naming convention | |
| Inside feature folders | |

---

## CI/CD Platform

| Option | Selected |
|--------|----------|
| GitHub Actions | ✓ |
| GitLab CI | |
| Skip for now | |

**Jobs:** Lint + type-check, Full test suite (real DB), Build check, npm security audit — all selected.

---

## Dev Environment

| Option | Selected |
|--------|----------|
| Docker Compose for postgres + redis | ✓ |
| Manual install | |
| Dev containers | |

**Additional:** Makefile required. All agents must use `make` targets — never raw commands. Fix the Makefile if a target fails; do not bypass it.

**Makefile commands:** `make up/down`, `make test/test:watch`, `make lint/lint:fix`, `make migrate/migrate:fresh` — plus `make dev`, `make build`, `make typecheck` at Claude's discretion.

**Test DB isolation:**
| Option | Selected |
|--------|----------|
| Separate test DB + transaction rollback per test | ✓ |
| Same DB, transaction rollback only | |
| Fresh DB per run | |

---

## Pre-commit Tooling

| Option | Selected |
|--------|----------|
| Lefthook | ✓ |
| Husky + lint-staged | |
| simple-git-hooks | |

**Hooks:** ESLint (hard block), TypeScript type errors (hard block), Prettier auto-fix, Conventional Commits commit-msg hook — all selected.

**Notes:** ESLint warnings are NOT OK. `--max-warnings 0` always. Suppress only with file-scoped or line-scoped disable comments (`// eslint-disable-next-line rule-name`). Project-wide rule disables in `eslint.config.js` are forbidden.

---

## Security

**HTTP headers:** Strict — full Helmet-equivalent: HSTS, CSP, X-Frame-Options: DENY, nosniff, Referrer-Policy.

**CORS:** Whitelist from `.env` (`CORS_ALLOWED_ORIGINS`). Empty = deny all.

**Input limits:** Both VineJS validator + DB column constraint. Every DB field must have an explicit character limit. Both layers must stay in sync.

**XSS:** Reject on write — VineJS rejects inputs containing HTML/script tags. No sanitization, just rejection.

**Image upload:** MIME type + magic bytes check, extension whitelist (.jpg/.jpeg/.png/.webp), oversized images (>12MB or >1920×1080) are compressed/resized server-side rather than rejected.

**Storage:** Cloudflare R2 (future). Storage adapter designed with R2's S3-compatible API in mind from Phase 1. Local/mock adapter used in Phase 1.

**Rate limiting:** Shared `RateLimit` middleware in `app/shared/middleware/`, Redis-backed. Per-route configuration. Foundation sets up the infrastructure.

## Claude's Discretion

- Specific ESLint rule set and Prettier config
- `japa.config.ts` exact setup
- BullMQ provider implementation
- `.env.example` contents and validation schema
- GitHub Actions workflow file details
- PostGIS extension migration

## Deferred Ideas

None.
