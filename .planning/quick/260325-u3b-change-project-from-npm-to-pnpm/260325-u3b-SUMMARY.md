---
phase: quick
plan: 260325-u3b
subsystem: tooling
tags: [pnpm, package-manager, ci, git-hooks]
dependency_graph:
  requires: []
  provides: [pnpm-lockfile, pnpm-ci-pipeline, pnpm-git-hooks]
  affects: [ci, git-hooks, makefile]
tech_stack:
  added: [pnpm@10.33.0]
  patterns: [pnpm-exec for local bins, pnpm/action-setup@v4 in CI, shamefully-hoist for AdonisJS]
key_files:
  created:
    - .npmrc
    - pnpm-lock.yaml
  modified:
    - Makefile
    - lefthook.yml
    - .github/workflows/ci.yml
    - tests/bootstrap.ts
    - app/shared/middleware/tenant_middleware.ts
    - tests/rls/tenant_isolation.spec.ts
decisions:
  - shamefully-hoist=true required in .npmrc for AdonisJS v7 CLI and module resolution
  - pnpm exec used for local bin invocation (not pnpm dlx which fetches remote packages)
  - pnpm/action-setup@v4 added before actions/setup-node in all 4 CI jobs
metrics:
  duration: ~7 minutes
  completed: "2026-03-26T00:45:58Z"
  tasks_completed: 2
  files_changed: 7
---

# Quick Task 260325-u3b: Migrate npm to pnpm Summary

**One-liner:** Replaced npm with pnpm 10.33.0 across lockfile, Makefile, lefthook, and all 4 CI jobs using shamefully-hoist for AdonisJS v7 compatibility.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install pnpm, generate lockfile, add .npmrc | 269ed21 | .npmrc, pnpm-lock.yaml, package-lock.json (deleted), tests/bootstrap.ts, tenant_middleware.ts, tenant_isolation.spec.ts |
| 2 | Update Makefile, lefthook.yml, and CI workflow | 77da6a6 | Makefile, lefthook.yml, .github/workflows/ci.yml |

## Verification Results

- `pnpm-lock.yaml` exists and committed: OK
- `package-lock.json` deleted: OK
- `.npmrc` contains `shamefully-hoist=true`: OK
- `make lint` passes via `pnpm exec eslint`: OK
- `make typecheck` passes via `pnpm exec tsc`: OK
- CI workflow has `pnpm/action-setup@v4` in all 4 jobs: OK
- CI workflow has `cache: 'pnpm'` in all 4 jobs: OK
- CI workflow has `pnpm install --frozen-lockfile` in all 4 jobs: OK
- No `npx` or `npm ci` references in Makefile, lefthook.yml, ci.yml: OK

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed tests/bootstrap.ts TypeScript errors exposed by pnpm install**
- **Found during:** Task 1 (commit hook typecheck)
- **Issue:** `pluginAdonisJS(testUtils)` passed `TestUtils` where `ApplicationService` is required. `httpServer().close()` called a method that does not exist — `start()` returns a close callback, there is no `.close()` method on `HttpServerUtils`.
- **Fix:** Switched to `import app from '@adonisjs/core/services/app'` for `pluginAdonisJS(app)`. Stored the close callback from `httpServer().start()` in `stopHttpServer` variable and called it in teardown.
- **Files modified:** `tests/bootstrap.ts`
- **Commit:** 269ed21

**2. [Rule 1 - Bug] Fixed pre-existing ESLint/Prettier errors in existing test files**
- **Found during:** Task 1 (make lint)
- **Issue:** `tests/rls/tenant_isolation.spec.ts` had Prettier formatting violations (multiline SQL strings). `app/shared/middleware/tenant_middleware.ts` had an unused `eslint-disable` directive.
- **Fix:** Ran `pnpm exec eslint . --fix` to auto-fix all three errors.
- **Files modified:** `tests/rls/tenant_isolation.spec.ts`, `app/shared/middleware/tenant_middleware.ts`
- **Commit:** 269ed21

**3. [Rule 3 - Blocker] pnpm install failed on first run due to lefthook core.hooksPath conflict**
- **Found during:** Task 1 (`pnpm install`)
- **Issue:** The worktree had `core.hooksPath` set locally to the main repo hooks directory, which lefthook's `prepare` script refused to overwrite.
- **Fix:** Ran `git config --unset-all --local core.hooksPath` to remove the override before re-running install.
- **Commit:** 269ed21 (included in same task)

## Known Stubs

None. This is a pure tooling migration with no application logic changes.

## Self-Check: PASSED

- `.npmrc` exists: FOUND
- `pnpm-lock.yaml` exists: FOUND
- `package-lock.json` absent: CONFIRMED
- Commit 269ed21: FOUND
- Commit 77da6a6: FOUND
