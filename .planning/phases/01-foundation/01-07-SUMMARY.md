---
phase: 01-foundation
plan: 07
subsystem: infra
tags: [adonisjs-queue, boringnode-queue, redis, sync-adapter, github-actions, rate-limiter, mermaid, docs]

requires:
  - phase: 01-01
    provides: AdonisJS v7 scaffold, package.json imports, adonisrc.ts providers
  - phase: 01-03
    provides: Redis config (config/redis.ts with 'main' connection)

provides:
  - "@adonisjs/queue configured with Redis (dev/prod) and Sync (test) adapters"
  - "HealthJob dispatch test passing via Sync adapter (ROADMAP Phase 1 criterion 4)"
  - "start/limiter.ts rate limiter skeleton ready for Phase 3+ feature limits"
  - "docs/templates/API.md with Mermaid sequenceDiagram skeleton"
  - "docs/templates/MODELS.md with Mermaid erDiagram + RLS policy SQL example"
  - ".github/workflows/ci.yml: 4-job CI pipeline with PostGIS+Redis service containers"

affects:
  - phase-3-reports: uses queue for cluster detection jobs; uses rate limiter for submissions
  - phase-4-clustering: dispatches ClusterEvaluationJob via same queue config
  - phase-5-moderation: uses queue for ML screening; rate limiter for flags
  - all-phases: CI pipeline validates every push; docs templates used for all feature docs

tech-stack:
  added:
    - "@adonisjs/queue v0.6.0 (backed by @boringnode/queue) — Redis adapter for prod, Sync adapter for tests"
    - "GitHub Actions CI with postgis/postgis:17-3.5 and redis:7-alpine service containers"
  patterns:
    - "Queue env switch: default adapter set to 'sync' when NODE_ENV=test, 'redis' otherwise"
    - "Job class registration: Locator.register('JobName', JobClass) in test group.setup()"
    - "Job dispatch: static JobClass.dispatch(payload) — not queue service dispatch"
    - "CI DB role: GRANT CONNECT only at database level; DML granted per-table after migrations"

key-files:
  created:
    - config/queue.ts
    - app/jobs/health_job.ts
    - tests/jobs/health_job.spec.ts
    - start/limiter.ts
    - docs/templates/API.md
    - docs/templates/MODELS.md
    - .github/workflows/ci.yml
  modified:
    - package.json (added #jobs/* import alias)
    - adonisrc.ts (added jobs test suite for tests/jobs/**)

key-decisions:
  - "config/queue.ts uses `default: 'sync'` when NODE_ENV=test (not a driver switch on redis config — the default adapter name changes)"
  - "Job dispatch uses static JobClass.dispatch(payload) method, not a queue service inject"
  - "Locator.register() called in test group.setup() to make job resolvable by Sync adapter"
  - "HealthJob extends Job<Record<string, never>> with execute() method (not handle())"
  - "CI app role gets GRANT CONNECT at DB level; DML grants run after make migrate completes"

patterns-established:
  - "Pattern: Queue adapter switch — env check in defineConfig default field, not in adapters"
  - "Pattern: Job test registration — Locator.register in group.setup() before dispatch"
  - "Pattern: Docs templates live in docs/templates/; per-feature docs go in docs/features/{name}/"

requirements-completed: [INFRA-08, INFRA-09]

duration: 20min
completed: 2026-03-25
---

# Phase 1 Plan 7: Queue/Redis/CI Infrastructure Summary

**@adonisjs/queue with Redis+Sync adapters, HealthJob Sync dispatch test (ROADMAP criterion 4), and GitHub Actions 4-job CI pipeline with PostGIS/Redis service containers**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-25T22:00:00Z
- **Completed:** 2026-03-25T22:20:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Queue configured with Redis driver for dev/prod and Sync driver for NODE_ENV=test; no Redis required for unit tests
- HealthJob dispatch test passes via Sync adapter — satisfies ROADMAP Phase 1 success criterion 4 ("a job can be dispatched and processed")
- GitHub Actions CI pipeline: lint (ESLint+tsc) → test (PostGIS 17-3.5 + Redis 7) → build → security; build depends on lint+test; all via make targets
- Docs templates with Mermaid sequence and ER diagram skeletons ready for all future feature docs

## Task Commits

1. **Task 1: Configure queue, HealthJob, docs templates** - `449389f` (feat)
2. **Task 2: GitHub Actions CI pipeline** - `bc1318c` (ci)

## Files Created/Modified

- `config/queue.ts` — Queue config: Redis adapter for dev/prod; Sync adapter default for test
- `app/jobs/health_job.ts` — Minimal job with static `executed` flag and `execute()` method
- `tests/jobs/health_job.spec.ts` — Sync adapter dispatch test; Locator.register in group.setup()
- `start/limiter.ts` — Rate limiter skeleton with Phase 3/5 limit comments
- `docs/templates/API.md` — Mermaid sequenceDiagram skeleton for all feature API docs
- `docs/templates/MODELS.md` — Mermaid erDiagram + RLS policy SQL for all feature model docs
- `.github/workflows/ci.yml` — 4-job CI: lint, test, build, security with service containers
- `package.json` — Added `#jobs/*` path alias for `app/jobs/`
- `adonisrc.ts` — Added `jobs` test suite covering `tests/jobs/**/*.spec.ts`

## Decisions Made

- Queue `default` adapter is `'sync'` when `NODE_ENV=test` (not a config provider switch — just the default name string changes). This avoids Redis connection on test startup.
- `@boringnode/queue` `Locator.register('HealthJob', HealthJob)` is required in `group.setup()` before dispatch — the Sync adapter looks up job classes by name via the Locator registry.
- `HealthJob` uses `execute()` (the `@boringnode/queue` Job interface), not `handle()` as the plan originally specified.
- CI creates the `app` role with `GRANT CONNECT` only (not `GRANT ALL`) — DML rights are granted per-table after migrations run, as required by INFRA-04 and D-07.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] config/queue.ts shape did not match actual @boringnode/queue API**
- **Found during:** Task 1 (Queue configuration)
- **Issue:** Plan proposed `defaultQueue`, `queue`, and `driver` properties. The actual `QueueConfig` interface from `@boringnode/queue` requires `default` (string) and `adapters` (Record). The proposed shape would fail at runtime.
- **Fix:** Used the correct `default`/`adapters` shape. Set `default` to `'sync'` when `NODE_ENV=test`, `'redis'` otherwise. Both adapters registered; only the default changes.
- **Files modified:** `config/queue.ts`
- **Verification:** `npx tsc --noEmit` exits 0; test passes
- **Committed in:** `449389f` (Task 1 commit)

**2. [Rule 1 - Bug] HealthJob used wrong base class and method name**
- **Found during:** Task 1 (HealthJob creation)
- **Issue:** Plan specified `extends BaseJob` and `async handle()`. `@adonisjs/queue` re-exports `Job` from `@boringnode/queue`; there is no `BaseJob` export. The correct method is `execute()`.
- **Fix:** `extends Job<Record<string, never>>` with `async execute()` method.
- **Files modified:** `app/jobs/health_job.ts`
- **Verification:** TypeScript compiles; test passes
- **Committed in:** `449389f` (Task 1 commit)

**3. [Rule 1 - Bug] Test used `queue.dispatch(HealthJob)` — not a real API**
- **Found during:** Task 1 (Test creation, RED phase)
- **Issue:** Plan test used `queue.dispatch(HealthJob)` (importing `@adonisjs/queue/services/main`). `QueueManager` has no `dispatch` method — dispatch is a static method on the `Job` class: `JobClass.dispatch(payload)`.
- **Fix:** Used `HealthJob.dispatch({})`. Added `Locator.register('HealthJob', HealthJob)` in `group.setup()` to make the job resolvable by name when the Sync adapter executes it.
- **Files modified:** `tests/jobs/health_job.spec.ts`
- **Verification:** `NODE_ENV=test node ace test --files="tests/jobs/health_job.spec.ts"` exits 0
- **Committed in:** `449389f` (Task 1 commit)

**4. [Rule 2 - Missing Critical] Added #jobs/* path alias and jobs test suite**
- **Found during:** Task 1 (Test setup)
- **Issue:** `#jobs/health_job` import in the test file would fail — no such alias existed. Test suite glob didn't cover `tests/jobs/`.
- **Fix:** Added `"#jobs/*": "./app/jobs/*.js"` to `package.json` imports. Added `jobs` test suite to `adonisrc.ts` tests config.
- **Files modified:** `package.json`, `adonisrc.ts`
- **Verification:** Import resolves; test suite runs
- **Committed in:** `449389f` (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (3 bugs in plan's API assumptions, 1 missing critical config)
**Impact on plan:** All fixes necessary for correctness — the plan's proposed shapes referenced non-existent APIs. Actual behavior is equivalent to what the plan intended.

## Issues Encountered

- Redis connection ECONNREFUSED warning appears in test output (non-fatal) — this is logged by the Redis provider connecting to the non-existent local Redis. It does not affect test results. The Sync adapter is used by the queue; Redis provider initializes separately and fails gracefully.

## Known Stubs

- `start/limiter.ts` — intentional empty stub. Contains only `export {}`. Rate limit definitions added in Phase 3 (submissions, RN-002) and Phase 5 (flags, RN-015).

## Next Phase Readiness

- Queue infrastructure ready for Phase 4 clustering jobs (ClusterEvaluationJob will use same `default: 'redis'` adapter)
- Rate limiter stub ready for Phase 3 submission endpoint
- CI pipeline runs on every push — automated quality gate operational
- Docs templates ready for Phase 2 feature documentation

---
*Phase: 01-foundation*
*Completed: 2026-03-25*
