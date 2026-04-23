---
phase: 11
slug: availability-signals-degraded-modes
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-23
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + Playwright + existing `verify-release` runtime scripts |
| **Config file** | `package.json` |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run test:logic:liveops && FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:critical && npm run verify:release -- --skip-deploy` |
| **Estimated runtime** | ~300-480 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run the narrowest phase gate for that wave, then escalate to `test:ui:critical` plus `verify:release -- --skip-deploy` before closing any deployed-stack or release-path change
- **Before `$gsd-verify-work`:** `npm run verify:release -- --skip-deploy` must be green against the canonical `3100/3101` runtime
- **Max feedback latency:** 420 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | AVAIL-03 | T-11-01 / T-11-02 | Shared helpers keep room availability truth separate from degraded subsystem state while admin runtime defaults stay normalized and safe | contract | `node --test test-logic/admin-control-plane.test.js` | ✅ | ✅ green |
| 11-01-02 | 01 | 1 | AVAIL-01, AVAIL-03 | T-11-02 / T-11-03 | Hub, room-entry, and room-detail payloads expose one additive degraded-state envelope without breaking current route compatibility | contract | `node --test test-logic/hub-room-entry.test.js test-logic/backend-contract.test.js && npm run check` | ✅ | ✅ green |
| 11-02-01 | 02 | 2 | AVAIL-03 | T-11-04 / T-11-05 | Operators can edit scoped degraded-mode controls and leave structured audit evidence through the existing admin runtime surface | node + browser | `node --test test-logic/admin-control-plane.test.js test-logic/live-room-ops.test.js && FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/admin-console.spec.js --workers=1` | ✅ | ✅ green |
| 11-02-02 | 02 | 2 | AVAIL-01 | T-11-05 / T-11-06 | Hub, entry, and party-room voice surfaces render the same degraded vocabulary and safe actions while healthy rooms continue working | node + browser | `node --test test-logic/hub-room-entry.test.js && FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/hub-entry.spec.js tests/arcade-party.spec.js --workers=1` | ✅ | ✅ green |
| 11-03-01 | 03 | 3 | AVAIL-01, AVAIL-03 | T-11-07 / T-11-08 | Regression suites prove degraded-state precedence, unaffected-family continuity, and admin/runtime consistency | full mixed | `npm run test:logic:liveops && FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/hub-entry.spec.js tests/admin-console.spec.js tests/arcade-party.spec.js --workers=1` | ✅ | ✅ green |
| 11-03-02 | 03 | 3 | AVAIL-01, AVAIL-03 | T-11-08 / T-11-09 | Canonical helper and release rerun paths on `3100/3101` cover degraded-state regressions without changing the shipped deploy contract | release | `FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:liveops && npm run verify:release -- --skip-deploy` | ✅ | ✅ green |
| 11-04-01 | 04 | 4 | AVAIL-01, AVAIL-03 | T-11-11 | Undercover hub and entry surfaces keep backend-authored degraded voice semantics truthful instead of falling back to generic text-only guidance | contract + browser | `node --test test-logic/hub-room-entry.test.js && FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/hub-entry.spec.js --workers=1` | ✅ | ✅ green |
| 11-04-02 | 04 | 4 | AVAIL-01, AVAIL-03 | T-11-10 / T-11-12 | Dedicated Undercover rooms expose turn-scoped mic access for the active clue speaker while keeping the shared degraded voice contract intact on the canonical release path | contract + release | `node --test test-logic/backend-contract.test.js && FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/undercover.spec.js --workers=1 && FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:critical && npm run verify:release -- --skip-deploy` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Existing test infrastructure is sufficient; no new framework or second release runner was needed
- [x] Stable `data-*` hooks back the degraded-state notices, subsystem status, and Undercover turn-based voice assertions used by Playwright
- [x] `test:logic:liveops`, `test:ui:liveops`, `test:ui:critical`, and `verify:release` stay aligned with the expanded degraded-state and Undercover voice surface

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Player-facing degraded notices are understandable and not misleading | AVAIL-01 | Automated tests can prove contract presence and selectors, but not whether the safe-action guidance is actually clear to a human operator/player | On the deployed `3100` frontend, trigger at least one entry-blocked and one voice-degraded state, then confirm the page explains what is still safe to do without reading source code |
| Scoped degraded mode does not over-broaden operational blast radius | AVAIL-03 | A fully realistic operator sanity check needs a real end-to-end stack and human judgment about what stayed healthy | On `3100/3101`, enable a family-scoped degraded mode, verify one unaffected family still creates/joins rooms normally, then verify the affected family shows the new controlled behavior and audit row |

---

## Validation Sign-Off

- [x] All tasks have automated verify commands or explicit release-gate coverage
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 420s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-23

---

## Validation Audit 2026-04-23

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Audit notes:
- Incorporated Plan `11-04` into the verification map after the initial draft was created.
- Confirmed all eight Phase 11 tasks have automated coverage or release-gate evidence in shipped summaries, with no missing test infrastructure.
