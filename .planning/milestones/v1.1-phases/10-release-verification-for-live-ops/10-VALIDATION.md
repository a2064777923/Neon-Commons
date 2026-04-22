---
phase: 10
slug: release-verification-for-live-ops
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test + Playwright + Docker Compose + package-script release runner |
| **Config file** | `package.json` |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run verify:release` |
| **Estimated runtime** | ~300-540 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run the narrowest gate that proves the wave (`node --test test-logic/session-recovery.test.js test-logic/room-directory-persistence.test.js test-logic/room-expiry.test.js test-logic/hub-room-entry.test.js` after Wave 1 recovery coverage changes, `npm run verify:release -- --skip-deploy` after Waves 2-3)
- **Before `$gsd-verify-work`:** `npm run verify:release` must be green against the canonical `3100/3101` runtime
- **Max feedback latency:** 540 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | RELY-03 | T-10-01 / T-10-02 | Critical node coverage proves reconnect grace, snapshot reload, stale-room expiry, and future room-ops backend paths from one release-facing command | full node suite | `npm run test:logic:critical` | ✅ | ⬜ pending |
| 10-01-02 | 01 | 1 | RELY-03 | T-10-03 / T-10-04 | Critical browser smoke proves recovery-aware entry behavior and future operator workflows on the canonical `3100` runtime | full browser suite | `FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:critical` | ✅ | ⬜ pending |
| 10-02-01 | 02 | 2 | RELY-03 | T-10-05 / T-10-06 | `verify:release` redeploys `3100/3101`, waits for readiness, and fails loud on any live-ops or recovery regression | release gate | `npm run verify:release` | ✅ | ⬜ pending |
| 10-02-02 | 02 | 2 | RELY-03 | T-10-06 | Operators can rerun the widened release gate without a second rebuild when only docs or flaky verification need a repeat pass | release rerun | `npm run verify:release -- --skip-deploy` | ✅ | ⬜ pending |
| 10-03-01 | 03 | 3 | RELY-03 | T-10-07 | Deployment, admin, and overview docs point at the exact release and live-ops verification commands that now exist | docs + command check | `npm run verify:release -- --skip-deploy` | ✅ | ⬜ pending |
| 10-03-02 | 03 | 3 | RELY-03 | T-10-08 | Planning traceability shows completed v1.1 work accurately and no longer leaves executed phases mislabeled as pending | docs + static | `npm run check && npm run test:logic:critical` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test-logic/session-recovery.test.js`, `test-logic/room-directory-persistence.test.js`, and `test-logic/room-expiry.test.js` are wired into the release-facing critical logic gate
- [ ] A room-ops backend regression file exists once Phase 8 APIs land, or the missing dependency is called out explicitly in the plan
- [ ] A recovery-aware Playwright smoke path exists for the blocked-entry / recovery-only UI branch
- [ ] A live room operations Playwright smoke path exists once Phase 8 UI workflows land

Existing deploy and release scripts already exist; Wave 0 is about filling the missing live-ops and recovery coverage they currently do not enforce.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The canonical `3100/3101` release gate is understandable to an operator after the live-ops additions | RELY-03 | Command success alone does not prove operator clarity | Follow `docs/ops/deployment.md` and `docs/admin/admin-guide.md` from a clean shell, run the documented commands, and confirm the room-ops/recovery release flow is explained without tribal knowledge |
| Recovery-only browser behavior remains understandable, not just blocked | RELY-03 | User-facing clarity around `snapshot-only` and reconnect timing is partly qualitative | On the deployed `3100` runtime, exercise the recovery entry flow and confirm the page explains why entry is paused before a live room exists again |
| Operator intervention smoke is trustworthy after Phase 8 lands | RELY-03 | Cross-browser/operator ergonomics and timing can be flaky even when assertions pass once | Run the room-ops smoke twice on the canonical stack after Phase 8, and confirm room inspect/intervention flows remain stable enough to be part of the release gate |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 540s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
