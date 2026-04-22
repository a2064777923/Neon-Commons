---
phase: 2
slug: admin-control-plane-expansion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test + Playwright |
| **Config file** | none |
| **Quick run command** | `npm run check` |
| **Full suite command** | `node --test test-logic/ddz-logic.test.js test-logic/backend-contract.test.js test-logic/client-network-contract.test.js test-logic/admin-control-plane.test.js` |
| **Estimated runtime** | ~75 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `node --test test-logic/ddz-logic.test.js test-logic/backend-contract.test.js test-logic/client-network-contract.test.js test-logic/admin-control-plane.test.js`
- **Before `$gsd-verify-work`:** Run `npx playwright test tests/admin-console.spec.js --workers=1`
- **Max feedback latency:** 75 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | ADMIN-01 / ADMIN-02 | T-01-01 / T-01-02 | Shared capability/runtime schema rejects unknown game keys and unsafe runtime fields | unit | `node --test test-logic/admin-control-plane.test.js` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | ADMIN-01 / ADMIN-02 | T-01-01 / T-01-02 | Explicit admin handlers require admin auth and validate structured updates | unit | `node --test test-logic/admin-control-plane.test.js` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | ADMIN-01 | T-01-03 | Disabled games and maintenance mode block only future room creation, not live room state | unit | `node --test test-logic/admin-control-plane.test.js` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 2 | ADMIN-01 / ADMIN-02 | T-02-01 | Admin page consumes structured capability/runtime APIs instead of raw JSON blobs | static | `npm run check` | ✅ | ⬜ pending |
| 2-02-02 | 02 | 2 | ADMIN-01 | T-02-01 / T-02-03 | Game-family toggle panels render with explicit new-room-only messaging | e2e | `npx playwright test tests/admin-console.spec.js --workers=1` | ❌ W0 | ⬜ pending |
| 2-02-03 | 02 | 2 | ADMIN-02 | T-02-02 / T-02-03 | Player quick actions and runtime controls remain usable after the UI refactor | e2e | `npx playwright test tests/admin-console.spec.js --workers=1` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 3 | ADMIN-02 | T-03-01 / T-03-02 | Audit payloads capture before/after data and are readable through an explicit admin endpoint | unit | `node --test test-logic/admin-control-plane.test.js` | ❌ W0 | ⬜ pending |
| 2-03-02 | 03 | 3 | ADMIN-01 / ADMIN-02 | T-03-01 | Recent admin changes are visible in the control surface without DB access | e2e | `npx playwright test tests/admin-console.spec.js --workers=1` | ❌ W0 | ⬜ pending |
| 2-03-03 | 03 | 3 | ADMIN-01 / ADMIN-02 | T-03-02 / T-03-03 | Capability toggles, runtime edits, and audit feed stay green under combined backend/UI smoke coverage | mixed | `node --test test-logic/admin-control-plane.test.js && npx playwright test tests/admin-console.spec.js --workers=1` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test-logic/admin-control-plane.test.js` — shared capability schema, handler auth/validation, and new-room-only gating
- [ ] `tests/admin-console.spec.js` — grouped admin console workflow, runtime edits, and audit feed smoke

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Existing live room stays playable after toggling that game off for new rooms | ADMIN-01 | Proving "new rooms only" across two concurrent browser sessions is expensive and brittle in one smoke test | Open a room in one browser session, toggle that game's capability off from `/admin` in another session, confirm the open room still accepts ready/chat/actions, and confirm creating a fresh room of the same game now fails with the expected disabled message. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 75s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
