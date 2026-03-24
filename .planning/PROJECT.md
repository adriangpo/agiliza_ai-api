# Agiliza Aí API

## What This Is

A multi-tenant REST API built with Adonis.js for "Agiliza Aí" — a municipal citizen-reporting system that lets city residents submit geolocated infrastructure complaints and managers triage, moderate, and resolve them. Each municipality is an isolated tenant. The API serves a mobile-first citizen app and a manager dashboard.

## Core Value

Citizens can submit a geolocated complaint and receive status updates — everything else (clustering, moderation, scoring) amplifies this but cannot replace it.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Identity & Access**
- [ ] User can register and authenticate with email/password (RN-001)
- [ ] User can authenticate via OAuth social login (RN-001)
- [ ] Each user has a unique identity per tenant; public profile shows only name and join date (RN-001)
- [ ] User is rate-limited to 5 publications per 24-hour rolling window (RN-002)
- [ ] User can delete their account; publications are anonymized to "Cidadão Anônimo" (RN-005)

**Geo & Reporting**
- [ ] Submission is blocked if GPS is more than 200m from the pinned location (RN-003)
- [ ] Submission is blocked if GPS accuracy is worse than 50m (US-01)
- [ ] User classifies themselves as "Residente" or "Turista" when reporting (RN-004)
- [ ] User can delete a publication only while its status is ABERTA (RN-010)
- [ ] User cannot edit a publication after submission (RN-010)

**Lifecycle & Clustering**
- [ ] System automatically creates a parent incident when 3+ same-category reports appear within 50m and 7 days (RN-006)
- [ ] Resolving a parent incident cascades resolution to all child incidents (RN-007)
- [ ] User can reopen a closed ticket within 15 days; if it was part of a cluster it becomes individual (RN-008)
- [ ] Each ticket allows only 1 reopening; second closure by manager is final (RN-009)
- [ ] Tickets resolved more than 30 days ago accept no new comments (new reports/flags still allowed) (RN-011)

**Moderation & Security**
- [ ] 3 unique user flags on a comment trigger Soft Hide and add it to the manager queue (RN-012)
- [ ] 3 unique user flags on a publication trigger Soft Hide on the full post (RN-013)
- [ ] ML image screening: score ≥ 0.95 triggers Auto-Hide immediately; implemented via pluggable HTTP adapter (RN-014)
- [ ] A user can flag a given item only once; per-user and per-IP hourly rate limits apply (RN-015)
- [ ] Original images with EXIF metadata are stored in a private bucket for 90 days; only moderators can access (RN-016)
- [ ] System detects malicious flag patterns and applies progressive restrictions: warning → 24h block → 7d block → suspension (RN-020)
- [ ] Public image delivery strips all EXIF metadata (RNF-02)

**Engagement & Feed**
- [ ] Relevance score: (Likes × 0.5) + (Comments × 1.0) + (Shares × 1.5); cluster multiplier ×2 (RN-017)
- [ ] Feed is ordered by relevance score; ties (≤5% diff) resolve to newest first (RN-018)
- [ ] Status changes and moderation actions trigger push notifications stored in notification center (RN-019)

**Management**
- [ ] Manager sees flag queue with evidence (flaggers, ML score, timestamps) (US-04)
- [ ] Manager can Restore (resets flags) or Delete (requires reason) a flagged item (US-04)
- [ ] Resolving a parent incident sends conclusion note to all child incidents automatically (US-05)
- [ ] All moderation actions are audit-logged (who, when, why) (RNF-07)

**Multi-Tenancy**
- [ ] All data is isolated per tenant via PostgreSQL RLS policies enforced at DB level
- [ ] Middleware sets session-level tenant context before any query runs
- [ ] Tenant context leakage is detectable and tested exhaustively

**Non-Functional**
- [ ] API protected against XSS, SQL injection, CSRF (RNF-01)
- [ ] Rate limiting on flags and publications per user and per IP (RNF-08)
- [ ] Cluster creation is idempotent under concurrent submissions (RNF-04)
- [ ] Heavy lint enforcement (ESLint + Prettier) from project init
- [ ] All features covered by TDD — tests are the source of truth
- [ ] Frontend documentation (models + endpoints) generated per feature, following a consistent template

### Out of Scope

- Temporal relevance decay — deferred to v2.0 per SRS
- Publication editing window — deferred to v1.1 per SRS
- Limit on images per publication — in backlog (recommended max 5, not yet specified)
- Map fallback / offline mode — frontend concern (RNF-05)
- WCAG 2.1 AA compliance — frontend concern (RNF-06)
- Image compression on client — mobile app concern (RNF-03 / US-01 AC4)

## Context

- **SRS reference:** https://github.com/matheuspereirasalvador/agiliza-ai-docs/blob/main/SRS.md (v1.4 Gold Master Final)
- **Architecture:** Feature-based folder structure — each feature owns its routes, controllers, services, models, migrations, tests, and docs
- **Framework:** Adonis.js v7 (Node.js 24, latest stable) with Lucid ORM v22
- **Database:** PostgreSQL with RLS policies; PostGIS available for geospatial queries
- **Auth:** Opaque access tokens + OAuth (Google/Apple) via `@adonisjs/auth` v10 (JWT guard removed in v7)
- **Testing:** Japa (Adonis.js native test runner); tests run on every change
- **ML adapter:** HTTP adapter interface with injectable mock for tests; real service plugged in later
- **Docs:** Per-feature API documentation (models + endpoints) following a shared template; always updated alongside code changes

## Constraints

- **Tech stack:** Adonis.js v7 (Node.js 24) — framework conventions must be followed, not worked around
- **Testing:** TDD is non-negotiable — no feature ships without tests written first
- **Security:** RLS tenant isolation must be tested; any cross-tenant data leak is a critical failure
- **Coupling:** No file should do too much — services, controllers, validators, and policies are always separate files
- **Lint:** ESLint + Prettier enforced from day one; CI must fail on lint errors
- **Versions:** Always use the latest stable version of all dependencies; never pin to outdated packages

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| PostgreSQL RLS for multi-tenancy | Well-implemented RLS is as strong as schema isolation; avoids per-schema migration complexity with Adonis.js | — Pending |
| `FORCE ROW LEVEL SECURITY` on all tenant-scoped tables | Prevents human error — even `migrator` (table owner) is subject to policies; no superuser credentials in app config | — Pending |
| Tenant IDs: UUID v7; all other IDs: bigint serial | Tenants are externally referenceable and should be non-guessable/non-sequential; UUID v7 is time-sortable; other tables use bigint for join performance | — Pending |
| Feature-based folder structure | Keeps all code for a feature co-located; prevents cross-feature coupling | — Pending |
| HTTP adapter for ML image screening | Avoids hard dependency on a specific ML vendor; mockable in tests; real service injected via config | — Pending |
| JWT + OAuth (no sessions) | API is mobile-first; stateless JWT is the right primitive; sessions add unnecessary complexity | — Pending |

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-23 after initialization*
