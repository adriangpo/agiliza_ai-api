# Roadmap: Agiliza Aí API

## Overview

Nine phases deliver a multi-tenant municipal citizen-reporting API. Foundation establishes the RLS contract and test harness that every subsequent phase depends on. Phase 01.1 performs the package-manager migration to pnpm. Auth gives users identity. Reports delivers the core citizen action — geolocated complaint submission. Clustering, Moderation, Feed, and Notifications amplify the core. Management closes the loop for operators.

Documentation (DOC-01–DOC-03) is a cross-cutting practice that happens in every phase alongside feature code. It is formally assigned to Phase 8 where the template is exercised on the final feature; all prior phases contribute to it. Phase 01.1 is an inserted tooling phase that migrates the repo from npm to pnpm before authentication work begins.

## Phases

- [ ] **Phase 1: Foundation** - Project scaffold, PostgreSQL + PostGIS + RLS, two DB roles, @adonisjs/queue (backed by @boringnode/queue), test harness, and CI
- [ ] **Phase 2: Authentication & Identity** - User registration, JWT + OAuth login, refresh tokens, token revocation, account deletion
- [ ] **Phase 3: Reports & Geospatial** - Geolocated complaint submission, GPS validation, EXIF handling, status lifecycle, rate limiting
- [ ] **Phase 4: Clustering** - Async cluster detection, idempotent parent incident creation, cascade resolution, reopen logic
- [ ] **Phase 5: Moderation** - User flagging, auto-hide thresholds, ML image screening adapter, malicious pattern detection, audit log
- [ ] **Phase 6: Feed & Engagement** - Relevance score formula, materialized score column, ordered feed endpoint
- [ ] **Phase 7: Notifications** - Event-driven notification dispatch, notification center read endpoint, push payload persistence
- [ ] **Phase 8: Management API** - Flag queue, manager actions, audit log access, tenant-scoped security hardening, documentation

## Phase Details

### Phase 1: Foundation

**Goal:** The project skeleton exists with enforced code quality, a running PostgreSQL + PostGIS database, two DB roles with `FORCE ROW LEVEL SECURITY` active (no superuser in app config), `@adonisjs/queue` (backed by `@boringnode/queue`) ready for jobs, tenants using UUID v7, all other tables using bigint serials, and a Japa test harness that rolls back transactions per test and injects tenant context — so every subsequent phase can write features on a stable, secure base.
**UI hint:** no
**Requirements:** INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-05b, INFRA-06, INFRA-07, INFRA-08, INFRA-09
**SRS rules:** RLS contract (no specific RN; foundational constraint), RNF-04 (BullMQ idempotency infrastructure)

**Success Criteria** (what must be TRUE):
1. `node ace lint` and `node ace build` pass with zero errors on the freshly scaffolded project
2. A test asserting tenant A cannot read tenant B's data fails at the DB layer (HTTP 404, not 403) and CI catches it as a red test if RLS is disabled
3. `TenantMiddleware` sets `set_config('app.tenant_id', ..., true)` inside a DB transaction; a test calling `SELECT current_setting('app.tenant_id')` outside a transaction returns null
4. A BullMQ job enqueued in a test is processed by the test worker without a Redis connection error
5. The CI pipeline (lint + type-check + test suite) completes green on a push with no feature code

**Plans:** 9/9 plans executed

### Phase 01.1: Change project to pnpm (latest) (INSERTED)

**Goal:** The repository uses `pnpm@10.33.0` as its sole package manager, `pnpm-lock.yaml` is generated from the existing npm lockfile via `pnpm import` so dependency resolution is preserved, local hooks and Make targets invoke repo-local tools through `pnpm exec`, and GitHub Actions installs with `pnpm install --frozen-lockfile` plus pnpm cache support — without bundling unrelated dependency refreshes or hoisting config changes.
**Requirements**: none explicitly mapped for this inserted phase
**Depends on:** Phase 1
**Plans:** 3/3 plans complete

Plans:
- [x] 01.1-01-PLAN.md — Pin `pnpm@10.33.0`, import the npm lockfile, and make `pnpm-lock.yaml` canonical
- [x] 01.1-02-PLAN.md — Move Makefile and Lefthook commands from `npx` to `pnpm exec` and add `make audit`
- [x] 01.1-03-PLAN.md — Update GitHub Actions to pnpm setup/cache/install and `make audit`

### Phase 2: Authentication & Identity

**Goal:** Users can create accounts, authenticate with email/password or OAuth, receive short-lived JWT access tokens with `tenantId` in the payload, refresh them, log out with immediate token invalidation, and delete their account with cascading anonymization — all scoped per tenant.
**UI hint:** yes
**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08
**SRS rules:** RN-001, RN-005

**Success Criteria** (what must be TRUE):
1. `POST /auth/register` creates a user, returns a JWT access token + refresh token with `tenantId` claim; a second identical request for the same tenant returns HTTP 409
2. `POST /auth/login` with valid credentials returns a fresh token pair; with invalid credentials returns HTTP 401
3. `POST /auth/refresh` exchanges a valid refresh token for a new access token; replaying the same refresh token returns HTTP 401
4. `POST /auth/logout` adds the token's `jti` to the Redis blocklist; the same access token on a subsequent authenticated request returns HTTP 401
5. `DELETE /users/me` removes PII from the user record, anonymizes the user's publications to "Cidadão Anônimo", and invalidates all tokens immediately

**Plans:** 4/4 plans executed

Plans:
- [x] 02-01-PLAN.md — Install packages + 3 migrations (users, auth_access_tokens, oauth_identities) + User model + OAuthIdentity model
- [x] 02-02-PLAN.md — Email/password auth (register, login, logout) + validators + AuthService + TDD tests
- [x] 02-03-PLAN.md — Google OAuth + profile endpoint (GET /users/me) + account deletion (AccountService) + TDD tests
- [x] 02-04-PLAN.md — Route registration + Bouncer UserPolicy + cross-tenant tests + API.md + MODELS.md

### Phase 02.2: Admin role and admin-only endpoints: tenant CRUD, user CRUD, platform management (INSERTED)

**Goal:** [Urgent work - to be planned]
**Requirements**: TBD
**Depends on:** Phase 2
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 02.2 to break down)

### Phase 02.1: Multi-tenant user access: one user belongs to many tenants (tenantId -> tenantIds, admin-granted membership) (INSERTED)

**Goal:** [Urgent work - to be planned]
**Requirements**: TBD
**Depends on:** Phase 2
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 02.1 to break down)

### Phase 3: Reports & Geospatial

**Goal:** An authenticated citizen can submit a geolocated complaint with category, description, optional image (EXIF-stripped for public delivery, original stored privately), GPS validation enforced at the server, rate limiting applied, and the ticket enters a lifecycle with an audit trail — and the user can view and delete their own open tickets.
**UI hint:** yes
**Requirements:** REP-01, REP-02, REP-03, REP-04, REP-05, REP-06, REP-07, REP-08, REP-09, REP-10, GEO-01, GEO-02, SEC-01, SEC-02
**SRS rules:** RN-002, RN-003, RN-004, RN-010, RN-016, US-01, US-02 AC1, RNF-01, RNF-02, RNF-08, RNF-09

**Success Criteria** (what must be TRUE):
1. `POST /reports` with GPS accuracy worse than 50m or distance from pin greater than 200m returns HTTP 422 with a validation error; distance is computed by PostGIS `ST_DWithin` — not JS-layer math
2. A 6th submission within a rolling 24-hour window returns HTTP 429; the 5th succeeds
3. The public image URL for a submitted report returns an image with no EXIF metadata; a moderator-authenticated request to the private bucket returns the original with EXIF intact
4. `GET /reports/me` returns the user's submission history with current status labels (`ABERTA`, `EM_ANALISE`, `RESOLVIDA`)
5. `DELETE /reports/:id` succeeds while status is `ABERTA`; the same request after a status transition to `EM_ANALISE` returns HTTP 403
6. All inputs pass VineJS validation; a request containing a SQL injection attempt or XSS payload is rejected at the validator layer, not reaching the service

**Plans:** TBD

### Phase 4: Clustering

**Goal:** After each report submission, an async BullMQ job evaluates whether 3+ same-category reports exist within 50m and 7 days; if so, it idempotently creates exactly one parent incident, and resolving that parent cascades resolution with a conclusion note to all children — with reopening and one-reopen-only constraints enforced.
**UI hint:** yes
**Requirements:** CLUS-01, CLUS-02, CLUS-03, CLUS-04, CLUS-05, CLUS-06, CLUS-07
**SRS rules:** RN-006, RN-007, RN-008, RN-009, RNF-04, US-02 AC2, US-02 AC3, US-05

**Success Criteria** (what must be TRUE):
1. Five concurrent submissions for the same location and category result in exactly one parent incident — confirmed by a test that fires 5 parallel HTTP requests and asserts `COUNT(parent_incidents) = 1`
2. Resolving the parent incident via `PATCH /incidents/:id/resolve` sets all child tickets to `RESOLVIDA` and attaches the conclusion note to each
3. A child ticket resolved fewer than 15 days ago can be reopened; one resolved more than 15 days ago returns HTTP 422
4. Reopening a clustered ticket removes it from the cluster and the API response includes the warning message about de-clustering
5. A second attempt to reopen the same ticket (after it has been closed again by a manager) returns HTTP 422 with the "final closure" reason

**Plans:** TBD

### Phase 5: Moderation

**Goal:** Authenticated users can flag comments and publications; 3 unique flags trigger auto-hide; the ML image screening adapter (pluggable HTTP interface) auto-hides images scoring ≥ 0.95 at upload time; malicious flagging patterns trigger progressive restrictions; and every moderation action is append-only audit-logged.
**UI hint:** yes
**Requirements:** MOD-01, MOD-02, MOD-03, MOD-04, MOD-05, MOD-06, MOD-07, MOD-08, MOD-09, SEC-04
**SRS rules:** RN-011, RN-012, RN-013, RN-014, RN-015, RN-016, RN-020, RNF-07, RNF-08

**Success Criteria** (what must be TRUE):
1. A user's 4th flag on the same item returns HTTP 422; the 3rd flag from a 3rd distinct user changes the item's visibility to `soft_hidden` and the API returns "Em análise" text for that item
2. Uploading an image whose ML mock returns a score of 0.95 triggers `Auto-Hide` immediately; a score of 0.94 does not
3. The ML adapter is resolved from the IoC container — swapping the binding from mock to real HTTP implementation requires no change to feature code
4. A user who flags 10 items in an hour receives a `warning` on flag 11; repeating the pattern progresses to `24h block`, then `7d block`, then `suspension`
5. `GET /audit-log?itemId=X` returns an ordered list of moderation events with actor, timestamp, and reason; authenticated as a moderator only

**Plans:** TBD

### Phase 6: Feed & Engagement

**Goal:** Reports are scored by a materialized relevance formula — `(likes × 0.5) + (comments × 1.0) + (shares × 1.5)` with a ×2 multiplier for parent cluster incidents — and the public feed endpoint returns reports ordered by score descending, with ties (≤5% diff) resolving to newest first.
**UI hint:** yes
**Requirements:** FEED-01, FEED-02, FEED-03
**SRS rules:** RN-017, RN-018

**Success Criteria** (what must be TRUE):
1. After a `like` event, the report's `relevance_score` column is updated in the database without a full recompute query — confirmed by checking that the score changes before the next query cycle
2. `GET /feed` returns reports in descending relevance order; two reports with scores within 5% of each other appear in newest-first order in the response
3. A parent cluster incident's score is twice the value calculated by the base formula
4. The feed endpoint does not compute relevance inline per request — `EXPLAIN ANALYZE` shows a simple column read, not a subquery

**Plans:** TBD

### Phase 7: Notifications

**Goal:** Every status transition and moderation action generates a persisted notification for the affected user, cascade resolutions notify all child incident owners, and users can retrieve their notification center via a paginated API endpoint — with push payload stored and ready for v2 delivery.
**UI hint:** yes
**Requirements:** NOTF-01, NOTF-02, NOTF-03, NOTF-04, NOTF-05
**SRS rules:** RN-007, RN-019, US-05

**Success Criteria** (what must be TRUE):
1. Transitioning a ticket from `ABERTA` to `EM_ANALISE` creates a row in the `notifications` table for the report owner; the row appears in `GET /notifications`
2. Soft-hiding a publication triggers a notification to its author; restoring it triggers a second notification
3. Resolving a parent incident creates notifications for all child incident owners containing the conclusion note text
4. `GET /notifications` returns notifications paginated, newest first, with read/unread status; `PATCH /notifications/:id/read` marks a notification read
5. Each notification row contains a `push_payload` JSON column populated with the delivery-ready FCM/APNs payload structure (channel delivery is v2)

**Plans:** TBD

### Phase 8: Management API

**Goal:** Managers authenticated to their tenant can view the flag queue with full evidence, restore or delete flagged items with audit logging, resolve parent incidents with conclusion notes, view audit logs for any item, and cross-tenant access is blocked by RLS — with per-feature API.md and MODELS.md documentation finalized across all features.
**UI hint:** yes
**Requirements:** MGT-01, MGT-02, MGT-03, MGT-04, MGT-05, MGT-06, SEC-03, DOC-01, DOC-02, DOC-03
**SRS rules:** US-04 AC1, US-04 AC2, US-04 AC3, US-05, RNF-07, INFRA-05 (cross-tenant enforcement)

**Success Criteria** (what must be TRUE):
1. `GET /manager/flag-queue` returns flagged items with: list of flagger user IDs, ML score (if applicable), and flag timestamps; authenticated as manager only
2. `POST /manager/items/:id/restore` clears all flags and returns the item to visible; `POST /manager/items/:id/delete` with no `reason` body returns HTTP 422; with a reason it soft-deletes and audit-logs the reason
3. A manager authenticated to tenant A receives HTTP 404 (not 403) when attempting to access tenant B's flag queue or reports — RLS enforcement verified in CI
4. `GET /manager/audit-log?itemId=X` returns the full audit trail for that item; entries are append-only (no UPDATE or DELETE on the audit table is possible from the `app` role)
5. Every feature folder contains `API.md` and `MODELS.md` following the established template; `DOC-03` compliance checked via a CI lint rule or manual verification checklist

**Plans:** TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 01.1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 9/9 | In Progress|  |
| 01.1 Change project to pnpm (latest) | 3/3 | Complete    | 2026-03-27 |
| 2. Authentication & Identity | 4/4 | Complete | 2026-03-27 |
| 3. Reports & Geospatial | 0/TBD | Not started | - |
| 4. Clustering | 0/TBD | Not started | - |
| 5. Moderation | 0/TBD | Not started | - |
| 6. Feed & Engagement | 0/TBD | Not started | - |
| 7. Notifications | 0/TBD | Not started | - |
| 8. Management API | 0/TBD | Not started | - |
