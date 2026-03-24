# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** Citizens can submit a geolocated complaint and receive status updates — everything else amplifies this but cannot replace it.
**Current focus:** Phase 1 — Foundation (not started)

## Current Position

Phase: 1 of 8 (Foundation)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-03-23 — Roadmap created; all 62 v1 requirements mapped to 8 phases

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Active decisions affecting Phase 1:

- PostgreSQL RLS for multi-tenancy: two DB roles (`migrator` owns DDL, `app` is RLS-restricted DML only) — status: Pending
- Feature-based folder structure: all code for a feature is co-located — status: Pending
- HTTP adapter for ML image screening: mockable from Phase 1, real service wired in Phase 5 — status: Pending
- JWT + OAuth (no sessions): stateless, mobile-first — status: Pending

### Open Questions (from research — resolve before phase begins)

- Is `@adonisjs/queue` (BullMQ wrapper) stable and v6-ready? Fallback: custom BullMQ provider.
- Will PgBouncer be used in deployment? If yes, `SET LOCAL` must be inside explicit `BEGIN...COMMIT` (Lucid `db.transaction()` handles this; verify pooler mode is `session`).

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-03-23
Stopped at: Roadmap written; STATE.md initialized; REQUIREMENTS.md traceability confirmed
Resume file: None
