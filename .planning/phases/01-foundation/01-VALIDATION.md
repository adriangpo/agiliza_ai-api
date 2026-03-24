---
phase: 1
slug: foundation
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-24
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Japa (`@japa/runner` v5, `@japa/plugin-adonisjs` v5) |
| **Config file** | `japa.config.ts` (Wave 0 creates it) |
| **Quick run command** | `make test` |
| **Full suite command** | `make test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `make lint && make typecheck`
- **After every plan wave:** Run `make test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| scaffold | 01 | 1 | INFRA-01 | integration | `make lint && make build` | ❌ W0 | ⬜ pending |
| eslint-config | 01 | 1 | INFRA-02 | integration | `make lint` | ❌ W0 | ⬜ pending |
| lefthook-setup | 01 | 1 | INFRA-02 | manual | hook triggers on staged commit | ❌ W0 | ⬜ pending |
| docker-compose | 01 | 1 | INFRA-03 | integration | `make up && docker ps` | ❌ W0 | ⬜ pending |
| db-roles | 01 | 2 | INFRA-04 | integration | `make migrate` with app role | ❌ W0 | ⬜ pending |
| rls-setup | 01 | 2 | INFRA-05 | integration | `make test` (rls suite) | ❌ W0 | ⬜ pending |
| tenants-migration | 01 | 2 | INFRA-05b | integration | `make migrate` | ❌ W0 | ⬜ pending |
| tenant-middleware | 01 | 2 | INFRA-06 | unit | `make test` (middleware spec) | ❌ W0 | ⬜ pending |
| japa-config | 01 | 1 | INFRA-07 | integration | `make test` | ❌ W0 | ⬜ pending |
| queue-setup | 01 | 3 | INFRA-08 | integration | `NODE_ENV=test node ace test --files="tests/jobs/health_job.spec.ts"` | ❌ W0 | ⬜ pending |
| ci-pipeline | 01 | 3 | INFRA-09 | manual | push to main triggers CI | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/rls/tenant_isolation.spec.ts` — stubs for INFRA-05/INFRA-06 cross-tenant tests
- [x] `app/features/.gitkeep` — feature folder structure scaffold
- [x] `japa.config.ts` — test runner config (glob: `app/features/**/*.spec.ts`, `tests/**/*.spec.ts`)
- [x] `Makefile` — all make targets defined before any task runs

*Note: AdonisJS v7 scaffold creates `tests/` and `japa.config.ts` automatically — Wave 0 extends rather than creates from scratch.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Lefthook pre-commit blocks lint violations | INFRA-02 | Requires actual git commit attempt | Stage a file with an eslint error; run `git commit`; verify it blocks |
| CI pipeline runs green on push | INFRA-09 | Requires GitHub push | Push to main; check Actions tab |
| Docker Compose services start with PostGIS | INFRA-03 | Requires Docker daemon | `make up`; `docker exec <pg-container> psql -U postgres -c "SELECT postgis_version();"` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
