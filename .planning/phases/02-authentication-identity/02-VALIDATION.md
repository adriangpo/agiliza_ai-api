---
phase: 2
slug: authentication-identity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Japa + @japa/api-client |
| **Config file** | `tests/bootstrap.ts` |
| **Quick run command** | `node ace test --files="tests/unit/auth"` |
| **Full suite command** | `node ace test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node ace test --files="tests/unit/auth"`
- **After every plan wave:** Run `node ace test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | AUTH-01 | integration | `node ace test --files="tests/functional/auth/register"` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | AUTH-02 | integration | `node ace test --files="tests/functional/auth/login"` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | AUTH-03 | integration | `node ace test --files="tests/functional/auth/logout"` | ❌ W0 | ⬜ pending |
| 2-01-04 | 01 | 1 | AUTH-04 | integration | `node ace test --files="tests/functional/auth/token"` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 2 | AUTH-05 | integration | `node ace test --files="tests/functional/auth/oauth"` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 2 | AUTH-06 | integration | `node ace test --files="tests/functional/users/delete"` | ❌ W0 | ⬜ pending |
| 2-04-01 | 04 | 1 | AUTH-07 | unit | `node ace test --files="tests/unit/auth/tenant"` | ❌ W0 | ⬜ pending |
| 2-04-02 | 04 | 1 | AUTH-08 | integration | `node ace test --files="tests/functional/auth/cross-tenant"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/functional/auth/register.spec.ts` — stubs for AUTH-01
- [ ] `tests/functional/auth/login.spec.ts` — stubs for AUTH-02
- [ ] `tests/functional/auth/logout.spec.ts` — stubs for AUTH-03
- [ ] `tests/functional/auth/token.spec.ts` — stubs for AUTH-04
- [ ] `tests/functional/auth/oauth.spec.ts` — stubs for AUTH-05
- [ ] `tests/functional/users/delete.spec.ts` — stubs for AUTH-06
- [ ] `tests/unit/auth/tenant.spec.ts` — stubs for AUTH-07
- [ ] `tests/functional/auth/cross-tenant.spec.ts` — stubs for AUTH-08

*Existing Japa infrastructure from Phase 1 covers the test runner — only test stubs are new.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google OAuth callback redirect | AUTH-05 | Requires external Google OAuth flow | Use Postman OAuth2 flow with test Google app credentials |
| Account anonymization display | AUTH-06 | UI-layer check | Query DB directly: `SELECT display_name FROM users WHERE id = :deleted_id` → must be "Cidadão Anônimo" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
