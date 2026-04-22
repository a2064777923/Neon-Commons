---
status: complete
phase: 09-single-node-recovery-guardrails
source:
  - 09-01-SUMMARY.md
  - 09-02-SUMMARY.md
  - 09-03-SUMMARY.md
started: 2026-04-22T14:17:44Z
updated: 2026-04-22T14:24:56Z
---

## Current Test
[testing complete]

## Tests

### 1. Cold start smoke test
expected: On a fresh canonical start or redeploy, the app should come back on ports 3100/3101 without manual repair. The homepage should load successfully, and a basic backend request such as /api/hub should return live data instead of a boot error or empty broken shell.
result: pass

### 2. Restart recovery discovery stays visible
expected: After a backend restart, room discovery should not silently forget every active room. Recovery-aware room metadata should still be resolvable through the shared room-entry flow, with restart-restored rooms surfaced honestly instead of disappearing or pretending to be fully live.
result: pass

### 3. Abandoned rooms expire instead of lingering
expected: If all human players leave and nobody reconnects before the reconnect window plus room expiry window pass, the room should disappear from discovery instead of lingering indefinitely as a ghost room.
result: pass

### 4. Snapshot-only rooms fail closed on entry
expected: A recovery-only room can remain visible, but opening its share or entry flow should not auto-enter the room or mint a guest seat. The UI should clearly indicate recovery state until a live room exists again.
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
