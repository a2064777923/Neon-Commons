---
phase: 9
slug: single-node-recovery-guardrails
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for restart-safe room-directory persistence and stale-room cleanup.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` |
| **Config file** | `package.json` scripts + existing node logic test harness |
| **Quick run command** | `node --test test-logic/room-directory-persistence.test.js` |
| **Full suite command** | `npm run check && node --test test-logic/room-directory-persistence.test.js test-logic/room-expiry.test.js test-logic/hub-room-entry.test.js test-logic/session-recovery.test.js` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test test-logic/room-directory-persistence.test.js`
- **After every plan wave:** Run `npm run check && node --test test-logic/room-directory-persistence.test.js test-logic/room-expiry.test.js test-logic/hub-room-entry.test.js test-logic/session-recovery.test.js`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | RELY-01 | T-09-01 / T-09-02 | Directory snapshots persist only minimal metadata needed for restart-safe discovery | unit | `node --test test-logic/room-directory-persistence.test.js` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | RELY-01 | T-09-03 | Backend startup rehydrates the shared directory without fabricating live manager rooms | unit + integration | `node --test test-logic/room-directory-persistence.test.js test-logic/hub-room-entry.test.js && npm run check` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 2 | RELY-02 | T-09-04 / T-09-05 | Rooms with no connected or reconnecting humans expire on one predictable window instead of lingering forever | unit | `node --test test-logic/room-expiry.test.js` | ❌ W0 | ⬜ pending |
| 09-02-02 | 02 | 2 | RELY-02 | T-09-06 | Reconnect grace still wins before stale cleanup, and snapshot rows are pruned with the same lifecycle | unit + integration | `node --test test-logic/room-expiry.test.js test-logic/session-recovery.test.js` | ❌ W0 | ⬜ pending |
| 09-03-01 | 03 | 3 | RELY-01 / RELY-02 | T-09-07 / T-09-08 | Hub and room-entry flows distinguish `live` from `snapshot-only` entries instead of advertising dead rooms as playable | integration | `node --test test-logic/hub-room-entry.test.js test-logic/room-directory-persistence.test.js` | ✅ | ⬜ pending |
| 09-03-02 | 03 | 3 | RELY-01 / RELY-02 | T-09-09 | Card, party, and board detail routes plus guest entry fail closed or degrade clearly when only snapshot metadata exists | integration | `npm run check && node --test test-logic/hub-room-entry.test.js test-logic/room-directory-persistence.test.js test-logic/room-expiry.test.js test-logic/session-recovery.test.js` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test-logic/room-directory-persistence.test.js` — snapshot write / reload / availability contract coverage
- [ ] `test-logic/room-expiry.test.js` — stale-room expiry and snapshot prune coverage

Existing infrastructure otherwise covers this phase.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Restarted discovery feels honest instead of pretending a dead room is still live | RELY-01 | The human check is whether the recovery messaging and navigation affordance are truthful across the deployed stack | Create a room, restart the backend/app stack, open the hub and room-entry flow, confirm recovered discovery is labeled clearly and does not auto-enter a non-live room |
| Expired rooms disappear on the deployed stack after the configured timeout | RELY-02 | Time-based lifecycle behavior is easier to sanity-check end-to-end on the canonical `3100/3101` stack than from unit output alone | Lower the expiry window in config for a local run, create and abandon a room, wait for expiry, then confirm the room disappears from hub/shareable/discovery surfaces |

---

## Validation Sign-Off

- [ ] All tasks have automated verify commands
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all missing references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter after implementation proves stable

**Approval:** pending
