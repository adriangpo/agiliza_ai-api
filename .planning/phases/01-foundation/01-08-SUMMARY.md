---
phase: 01-foundation
plan: 08
subsystem: infra
tags: [nodejs, engines, package-json, runtime-constraint]

# Dependency graph
requires: []
provides:
  - "package.json engines field declaring Node.js >=24"
  - "npm/CI warning on incompatible Node.js versions"
affects: [CI, onboarding, all future plans]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "engines field in package.json enforces runtime constraint at tooling level"

key-files:
  created: []
  modified:
    - package.json

key-decisions:
  - "engines.node >=24 placed after private field per conventional ordering; satisfies AdonisJS v7 and CLAUDE.md Node.js 24 constraint"

patterns-established:
  - "Runtime constraint declared in package.json so npm warns contributors and CI fails on incompatible Node.js versions"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-03-27
---

# Phase 01 Plan 08: Node.js 24 Engines Field Summary

**`"engines": { "node": ">=24" }` added to package.json so npm warns contributors and CI fails fast on incompatible Node.js versions**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T17:38:35Z
- **Completed:** 2026-03-27T17:41:00Z
- **Tasks:** 1 completed, 1 pending human checkpoint
- **Files modified:** 1 (package.json)

## Accomplishments

- package.json now declares the Node.js >=24 constraint programmatically
- npm and CI tooling will warn or error when an incompatible Node.js version is active
- No other package.json fields were modified — clean, minimal change

## Task Commits

Each task was committed atomically:

1. **Task 1: Add engines field to package.json** - `2741778` (chore — committed via quick task 260325-u17)
2. **Task 2: Install Node.js 24 on developer machine** - PENDING human checkpoint

**Plan metadata:** (committed below)

## Files Created/Modified

- `package.json` - Added `"engines": { "node": ">=24" }` after `"private": true`

## Decisions Made

- engines.node set to `>=24` (not `=24`) to allow patch releases and future minor bumps without plan edits

## Deviations from Plan

**Task 1 was already complete.** The quick task 260325-u17 (commit `2741778`) had already added the engines field to package.json before this plan executed. Verification confirmed the field is present and valid JSON. No duplicate work performed.

None beyond the above observation — plan executed correctly given pre-existing state.

## Issues Encountered

None — engines field was already in place from quick task 260325-u17.

## User Setup Required

**Task 2 (checkpoint:human-verify) — Install Node.js 24 on developer machine**

The machine currently runs Node.js v22.22.0. The developer must install Node.js 24 using their version manager:

**Option A — fnm (recommended):**
```bash
fnm install 24
fnm use 24
node --version   # must print v24.x.x
```

**Option B — nvm:**
```bash
nvm install 24
nvm use 24
node --version   # must print v24.x.x
```

**Option C — system package manager (Fedora/dnf):**
```bash
sudo dnf module enable nodejs:24
sudo dnf install nodejs
node --version   # must print v24.x.x
```

After installation, verify the project still boots:
```bash
node --version   # v24.x.x
node ace --help  # AdonisJS CLI responds without errors
```

## Next Phase Readiness

- package.json engines constraint is in place — ready for CI and contributor tooling to enforce Node.js 24
- Task 2 (Node.js 24 machine installation) is a human action; CI/CD is not blocked by this
- All existing scripts (start, build, dev, test, lint) remain unchanged

---
*Phase: 01-foundation*
*Completed: 2026-03-27*

## Self-Check: PASSED

- `package.json` engines field: FOUND (verified via `node -e` JSON parse)
- Commit `2741778` exists: FOUND (`git log --oneline` confirms)
- SUMMARY.md created at `.planning/phases/01-foundation/01-08-SUMMARY.md`
