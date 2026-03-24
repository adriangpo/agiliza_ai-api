# Requirements: Agiliza Aí API

**Defined:** 2026-03-23
**Core Value:** Citizens can submit a geolocated complaint and receive status updates — everything else amplifies this but cannot replace it.

> **SRS Reference:** https://github.com/matheuspereirasalvador/agiliza-ai-docs/blob/main/SRS.md (v1.4 Gold Master Final)
> Business rules are subject to change. Every requirement below references its source rule ID. When the SRS changes, grep the rule ID to find all affected code, tests, and docs.

---

## v1 Requirements

### Foundation & Infrastructure

- [ ] **INFRA-01**: Project scaffolded with AdonisJS v7 API kit (Node.js 24), TypeScript, and feature-based folder structure
- [ ] **INFRA-02**: ESLint v10 flat config + Prettier enforced; Lefthook pre-commit hooks block non-conforming commits
- [ ] **INFRA-03**: PostgreSQL database configured with PostGIS extension enabled
- [ ] **INFRA-04**: Two DB roles established: `migrator` (DDL + RLS policy owner) and `app` (DML only, RLS-restricted); no superuser credentials ever present in application config
- [ ] **INFRA-05**: `FORCE ROW LEVEL SECURITY` applied to all tenant-scoped tables — enforces RLS even on the table owner (`migrator`), preventing human error from direct DB connections
- [ ] **INFRA-05b**: Tenants table uses UUID v7 as primary key; all other tables use `bigint` serial/incremental IDs; tenant FK columns on all tables are `uuid` type
- [ ] **INFRA-06**: `TenantMiddleware` sets `set_config('app.tenant_id', ..., true)` inside a transaction before every query — verified with exhaustive cross-tenant leakage tests
- [ ] **INFRA-07**: Japa test runner configured with database transaction rollback per test; global tenant context injectable in tests
- [ ] **INFRA-08**: `@adonisjs/queue` + Redis configured for async background jobs (clustering, notifications, ML screening); Sync adapter used in test environment
- [ ] **INFRA-09**: CI pipeline runs lint, type-check, and full test suite on every push

### Authentication & Identity

- [ ] **AUTH-01**: User can register with unique email and password per tenant (RN-001)
- [ ] **AUTH-02**: User can authenticate via OAuth social login — Google; Apple if driver available (RN-001)
- [ ] **AUTH-03**: User receives an opaque access token on login (AdonisJS v7 auth v10 access tokens guard, DB-backed); tenant context is loaded from the user record per request — no JWT, no token payload claims
- [ ] **AUTH-04**: Access tokens expire; user can obtain a fresh token by re-authenticating (or via refresh token if supported by auth v10 guard)
- [ ] **AUTH-05**: Refresh tokens are invalidated on logout; token blocklist stored in Redis
- [ ] **AUTH-06**: User's public profile exposes only display name and join date (RN-001)
- [ ] **AUTH-07**: User can delete their account; all personal data removed, publications anonymized to "Cidadão Anônimo" (RN-005)
- [ ] **AUTH-08**: Deleted account tokens are invalidated immediately via blocklist (RN-005)

### Reports (Ticket Submission)

- [ ] **REP-01**: Authenticated user can submit a report with: category, description, optional image, GPS coordinates, and pin location (US-01)
- [ ] **REP-02**: Submission is blocked if distance between GPS position and pin exceeds 200m (RN-003, US-01 AC2)
- [ ] **REP-03**: Submission is blocked if GPS accuracy is worse than 50m (US-01 AC3)
- [ ] **REP-04**: User must classify themselves as "Residente" or "Turista" on submission (RN-004)
- [ ] **REP-05**: User is rate-limited to 5 submissions in any rolling 24-hour window; 6th attempt returns HTTP 429 (RN-002)
- [ ] **REP-06**: User can delete their own report only while its status is `ABERTA` (RN-010)
- [ ] **REP-07**: User cannot edit a submitted report (RN-010)
- [ ] **REP-08**: Submitted report enters `ABERTA` status; transitions are `ABERTA → EM_ANALISE → RESOLVIDA` with audit trail
- [ ] **REP-09**: User can view their own submission history with current status labels (US-02 AC1)
- [ ] **REP-10**: Report image is delivered publicly with EXIF data stripped; original with EXIF stored in private bucket for 90 days (RN-016, RNF-02, RNF-09)

### Geospatial

- [ ] **GEO-01**: All coordinate distance calculations use PostGIS `ST_DWithin(geography, geography, meters)` — never application-layer math (RN-003, RN-006)
- [ ] **GEO-02**: Coordinates stored as PostGIS `geography(Point, 4326)` columns, not plain lat/lon floats

### Clustering

- [ ] **CLUS-01**: `ClusterEvaluationJob` runs asynchronously after each submission; creates a parent incident when 3+ same-category reports exist within 50m radius and 7-day window (RN-006)
- [ ] **CLUS-02**: Cluster creation is idempotent under concurrent submissions — PostgreSQL advisory lock prevents duplicate parent incidents (RNF-04)
- [ ] **CLUS-03**: Resolving a parent incident cascades `RESOLVIDA` status to all child incidents (RN-007)
- [ ] **CLUS-04**: Cascade resolution sends manager's conclusion note to all child incidents automatically (US-05)
- [ ] **CLUS-05**: User can reopen their ticket within 15 days of resolution (RN-008, US-02 AC2)
- [ ] **CLUS-06**: Reopening a clustered ticket removes it from the cluster and converts it to an individual incident; user sees warning before confirming (RN-008, US-02 AC3)
- [ ] **CLUS-07**: Each ticket allows exactly 1 reopening; second manager closure is final (RN-009)

### Moderation

- [ ] **MOD-01**: Authenticated user can flag a comment; one flag per user per comment (RN-015)
- [ ] **MOD-02**: Authenticated user can flag a full publication; one flag per user per publication (RN-013, RN-015)
- [ ] **MOD-03**: 3 unique user flags on a comment trigger Soft Hide — comment shows "Em análise" (RN-012)
- [ ] **MOD-04**: 3 unique user flags on a publication trigger Soft Hide — text shows "Em análise", image hidden (RN-013)
- [ ] **MOD-05**: Flag rate limits enforced per user and per IP to prevent coordinated flag attacks (RN-015, RNF-08)
- [ ] **MOD-06**: ML image screening runs on upload via injectable HTTP adapter; score ≥ 0.95 triggers Auto-Hide immediately (RN-014)
- [ ] **MOD-07**: Malicious flag detection monitors flag-then-restore patterns; progressive action applied: warning → 24h block → 7d block → suspension (RN-020)
- [ ] **MOD-08**: All moderation actions are audit-logged with actor, timestamp, and reason (RNF-07)
- [ ] **MOD-09**: Tickets resolved more than 30 days ago reject new comments; flags are still accepted (RN-011)

### Feed & Engagement

- [ ] **FEED-01**: Relevance score computed as `(likes × 0.5) + (comments × 1.0) + (shares × 1.5)`; cluster multiplier ×2 applied to parent incidents (RN-017)
- [ ] **FEED-02**: Feed endpoint returns reports ordered by relevance score descending; ties (score difference ≤ 5%) resolve to newest first (RN-018)
- [ ] **FEED-03**: Relevance score is stored as a materialized column, updated on each engagement event — not computed per query

### Notifications

- [ ] **NOTF-01**: Status change events (ABERTA → EM_ANALISE → RESOLVIDA) trigger a notification to the report owner (RN-019)
- [ ] **NOTF-02**: Moderation actions (Soft Hide, Restore, Delete) trigger a notification to the affected user (RN-019)
- [ ] **NOTF-03**: Cascade resolution notification sent to child incident owners (RN-007, US-05)
- [ ] **NOTF-04**: Notifications are persisted in a `notifications` table; user can retrieve their notification center via API
- [ ] **NOTF-05**: Push notification payload stored and ready for delivery (push delivery channel is a v2 concern)

### Management API

- [ ] **MGT-01**: Manager can view the flag queue with evidence: flaggers list, ML score if applicable, flag timestamps (US-04 AC1)
- [ ] **MGT-02**: Manager can Restore a flagged item — clears all flags, returns item to visible (US-04 AC2)
- [ ] **MGT-03**: Manager can Delete a flagged item — requires a reason; reason is audit-logged (US-04 AC3)
- [ ] **MGT-04**: Manager can resolve a parent incident with a conclusion note (US-05)
- [ ] **MGT-05**: Manager can view full audit log for any item (RNF-07)
- [ ] **MGT-06**: Manager actions are scoped to their tenant; cross-tenant access is blocked by RLS (INFRA-05)

### Security & Non-Functional

- [ ] **SEC-01**: All input validated and sanitized; API protected against XSS, SQL injection, CSRF (RNF-01)
- [ ] **SEC-02**: Rate limiting applied on all public endpoints and flag/submission endpoints specifically (RNF-08)
- [ ] **SEC-03**: Tenant isolation tested exhaustively — any cross-tenant data leak is a CI-breaking failure
- [ ] **SEC-04**: Private image bucket accessible only by authenticated moderators (RN-016)

### Documentation

- [ ] **DOC-01**: Each feature folder contains `API.md` documenting all endpoints — method, path, auth, request schema, response schema, error codes, example payloads
- [ ] **DOC-02**: Each feature folder contains `MODELS.md` documenting all data models — fields, types, constraints, relationships, business rule references
- [ ] **DOC-03**: All docs follow the same template (established in Phase 1); updated in the same commit as code changes

---

## v2 Requirements

### Engagement
- **ENG-01**: Temporal relevance decay — older posts gradually lose score weight (SRS v2.0 deferral)
- **ENG-02**: Publication editing window — short window after submission (SRS v1.1 evaluation)

### Reporting & Analytics
- **ANLX-01**: Per-tenant analytics dashboard (complaint categories, resolution rates, cluster heatmaps)
- **ANLX-02**: Open311 compatible export endpoint

### Media
- **MEDIA-01**: Maximum images per publication enforced (recommended 5; SRS backlog)

### Notifications
- **NOTF-P01**: Actual push notification delivery via FCM/APNs (v1 stores payload only)

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Temporal relevance decay | Explicitly deferred to SRS v2.0 |
| Publication editing | Deferred to SRS v1.1 evaluation |
| Image compression (client-side) | Mobile app concern (RNF-03); API receives already-compressed image |
| Map fallback / offline mode | Frontend concern (RNF-05) |
| WCAG 2.1 AA compliance | Frontend concern (RNF-06) |
| Real-time websocket feed | High complexity; polling sufficient for v1 |
| SLA tracking per ticket | Not in SRS; common v2 request — resist for v1 |
| Direct messaging between users | Not in SRS |
| Multi-image per publication | In SRS backlog with no spec; exclude until SRS defines limit and behavior |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1: Foundation | Pending |
| INFRA-02 | Phase 1: Foundation | Pending |
| INFRA-03 | Phase 1: Foundation | Pending |
| INFRA-04 | Phase 1: Foundation | Pending |
| INFRA-05 | Phase 1: Foundation | Pending |
| INFRA-05b | Phase 1: Foundation | Pending |
| INFRA-06 | Phase 1: Foundation | Pending |
| INFRA-07 | Phase 1: Foundation | Pending |
| INFRA-08 | Phase 1: Foundation | Pending |
| INFRA-09 | Phase 1: Foundation | Pending |
| AUTH-01 | Phase 2: Authentication & Identity | Pending |
| AUTH-02 | Phase 2: Authentication & Identity | Pending |
| AUTH-03 | Phase 2: Authentication & Identity | Pending |
| AUTH-04 | Phase 2: Authentication & Identity | Pending |
| AUTH-05 | Phase 2: Authentication & Identity | Pending |
| AUTH-06 | Phase 2: Authentication & Identity | Pending |
| AUTH-07 | Phase 2: Authentication & Identity | Pending |
| AUTH-08 | Phase 2: Authentication & Identity | Pending |
| REP-01 | Phase 3: Reports & Geospatial | Pending |
| REP-02 | Phase 3: Reports & Geospatial | Pending |
| REP-03 | Phase 3: Reports & Geospatial | Pending |
| REP-04 | Phase 3: Reports & Geospatial | Pending |
| REP-05 | Phase 3: Reports & Geospatial | Pending |
| REP-06 | Phase 3: Reports & Geospatial | Pending |
| REP-07 | Phase 3: Reports & Geospatial | Pending |
| REP-08 | Phase 3: Reports & Geospatial | Pending |
| REP-09 | Phase 3: Reports & Geospatial | Pending |
| REP-10 | Phase 3: Reports & Geospatial | Pending |
| GEO-01 | Phase 3: Reports & Geospatial | Pending |
| GEO-02 | Phase 3: Reports & Geospatial | Pending |
| SEC-01 | Phase 3: Reports & Geospatial | Pending |
| SEC-02 | Phase 3: Reports & Geospatial | Pending |
| CLUS-01 | Phase 4: Clustering | Pending |
| CLUS-02 | Phase 4: Clustering | Pending |
| CLUS-03 | Phase 4: Clustering | Pending |
| CLUS-04 | Phase 4: Clustering | Pending |
| CLUS-05 | Phase 4: Clustering | Pending |
| CLUS-06 | Phase 4: Clustering | Pending |
| CLUS-07 | Phase 4: Clustering | Pending |
| MOD-01 | Phase 5: Moderation | Pending |
| MOD-02 | Phase 5: Moderation | Pending |
| MOD-03 | Phase 5: Moderation | Pending |
| MOD-04 | Phase 5: Moderation | Pending |
| MOD-05 | Phase 5: Moderation | Pending |
| MOD-06 | Phase 5: Moderation | Pending |
| MOD-07 | Phase 5: Moderation | Pending |
| MOD-08 | Phase 5: Moderation | Pending |
| MOD-09 | Phase 5: Moderation | Pending |
| SEC-04 | Phase 5: Moderation | Pending |
| FEED-01 | Phase 6: Feed & Engagement | Pending |
| FEED-02 | Phase 6: Feed & Engagement | Pending |
| FEED-03 | Phase 6: Feed & Engagement | Pending |
| NOTF-01 | Phase 7: Notifications | Pending |
| NOTF-02 | Phase 7: Notifications | Pending |
| NOTF-03 | Phase 7: Notifications | Pending |
| NOTF-04 | Phase 7: Notifications | Pending |
| NOTF-05 | Phase 7: Notifications | Pending |
| MGT-01 | Phase 8: Management API | Pending |
| MGT-02 | Phase 8: Management API | Pending |
| MGT-03 | Phase 8: Management API | Pending |
| MGT-04 | Phase 8: Management API | Pending |
| MGT-05 | Phase 8: Management API | Pending |
| MGT-06 | Phase 8: Management API | Pending |
| SEC-03 | Phase 8: Management API | Pending |
| DOC-01 | Phase 8: Management API (cross-cutting; practiced every phase) | Pending |
| DOC-02 | Phase 8: Management API (cross-cutting; practiced every phase) | Pending |
| DOC-03 | Phase 8: Management API (cross-cutting; practiced every phase) | Pending |

**Coverage:**
- v1 requirements: 67 total
- Mapped to phases: 66
- Unmapped: 0 ✓

**Phase assignment notes:**
- SEC-01 and SEC-02 (input validation, rate limiting) are assigned to Phase 3 — they are enforced at the submission layer and apply globally from that point forward
- SEC-04 (private bucket access) is assigned to Phase 5 — it governs moderator access to the original EXIF images introduced in Phase 3 but enforced via moderator role established in Phase 5
- SEC-03 (exhaustive cross-tenant test coverage) is assigned to Phase 8 — it is the final verification sweep, though per-phase RLS contract tests run throughout
- DOC-01–DOC-03 are formally assigned to Phase 8 where the template is exercised on the last feature; the practice is applied in every prior phase

---
*Requirements defined: 2026-03-23*
*Last updated: 2026-03-23 — traceability expanded after roadmap creation*
