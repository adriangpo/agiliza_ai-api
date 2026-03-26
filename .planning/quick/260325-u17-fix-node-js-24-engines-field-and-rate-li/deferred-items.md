# Deferred Items — 260325-u17

Pre-existing issues discovered during execution but out of scope for this plan.

## Lint errors in unrelated files

- **File:** `app/shared/middleware/tenant_middleware.ts`
- **File:** `tests/rls/tenant_isolation.spec.ts`
- **Issue:** prettier/prettier formatting violations (3 errors, 1 warning)
- **Discovered during:** Task 2 verification (npm run lint)
- **Action needed:** Run `npm run lint:fix` on these files in a follow-up task
- **Does NOT affect this plan's goals** — the modified files (rate_limit_middleware.ts, start/limiter.ts, package.json) lint cleanly
