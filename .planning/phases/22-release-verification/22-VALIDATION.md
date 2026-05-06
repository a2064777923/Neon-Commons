---
phase: 22
slug: release-verification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-06
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (logic) + Playwright (UI) |
| **Config file** | none — runner flags in package.json scripts |
| **Quick run command** | `node --test test-logic/<game>-logic.test.js` |
| **Full suite command** | `npm run test:logic:critical && npm run test:ui:critical` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test test-logic/<game>-logic.test.js` (per-game)
- **After every plan wave:** Run `npm run test:logic:critical && npm run test:ui:critical`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | PLAT-06 | — | N/A | unit | `node --test test-logic/pickred-logic.test.js` | ❌ W0 | ⬜ pending |
| 22-01-02 | 01 | 1 | PLAT-06 | — | N/A | unit | `node --test test-logic/bigtwo-logic.test.js` | ❌ W0 | ⬜ pending |
| 22-01-03 | 01 | 1 | PLAT-06 | — | N/A | unit | `node --test test-logic/mahjong-logic.test.js` | ✅ extend | ⬜ pending |
| 22-01-04 | 01 | 1 | PLAT-06 | — | N/A | unit | `node --test test-logic/racing-logic.test.js` | ✅ extend | ⬜ pending |
| 22-01-05 | 01 | 1 | PLAT-06 | — | N/A | unit | `node --test test-logic/fighting-logic.test.js` | ✅ extend | ⬜ pending |
| 22-02-01 | 02 | 2 | PLAT-06 | — | N/A | e2e | `playwright test tests/pickred-entry.spec.js` | ❌ W0 | ⬜ pending |
| 22-02-02 | 02 | 2 | PLAT-06 | — | N/A | e2e | `playwright test tests/bigtwo-entry.spec.js` | ❌ W0 | ⬜ pending |
| 22-02-03 | 02 | 2 | PLAT-06 | — | N/A | e2e | `playwright test tests/mahjong.spec.js` | ✅ extend | ⬜ pending |
| 22-02-04 | 02 | 2 | PLAT-06 | — | N/A | e2e | `playwright test tests/racing-entry.spec.js` | ✅ exists | ⬜ pending |
| 22-02-05 | 02 | 2 | PLAT-06 | — | N/A | e2e | `playwright test tests/fighting-entry.spec.js` | ❌ W0 | ⬜ pending |
| 22-03-01 | 03 | 2 | PLAT-06 | — | N/A | unit | Catalog assertion in test | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test-logic/pickred-logic.test.js` — full-round smoke test for Pick Red
- [ ] `test-logic/bigtwo-logic.test.js` — full-round smoke test for Big Two
- [ ] `tests/pickred-entry.spec.js` — Playwright UI smoke for Pick Red
- [ ] `tests/bigtwo-entry.spec.js` — Playwright UI smoke for Big Two
- [ ] `tests/fighting-entry.spec.js` — Playwright UI smoke for Fighting
- [ ] Catalog rollout state assertion test

*Existing files to extend: `test-logic/mahjong-logic.test.js`, `test-logic/racing-logic.test.js`, `test-logic/fighting-logic.test.js`, `tests/mahjong.spec.js`, `tests/racing-entry.spec.js`*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full game round completes with winner | PLAT-06 | Bot-assisted tests need real game state | Run each game's logic test, verify winner declared |
| Reconnection recovers game state | PLAT-06 | Disconnect/reconnect requires socket manipulation | Run reconnection test, verify hand/position preserved |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
