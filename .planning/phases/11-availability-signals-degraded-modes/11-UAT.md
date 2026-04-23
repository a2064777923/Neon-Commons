---
status: complete
phase: 11-availability-signals-degraded-modes
source:
  - 11-01-SUMMARY.md
  - 11-02-SUMMARY.md
  - 11-03-SUMMARY.md
started: 2026-04-23T10:22:30+08:00
updated: 2026-04-23T11:56:33+08:00
---

## Current Test

[testing complete]

## Tests

### 1. Admin degraded controls and audit trace
expected: Open `/admin` as an admin and change one scoped degraded control, for example `family:party / voice` from healthy to blocked. The admin page should show the new service status immediately, display the matching safe-action guidance, and add a recent audit entry / trace badge that makes the scope of the change clear.
result: pass

### 2. Hub and room-entry degraded guidance
expected: When a family or subsystem is degraded/blocked, the hub card and `/entry/[gameKey]/[roomNo]` should use the same degraded vocabulary, show safe actions, and prevent risky auto-enter behavior instead of failing silently.
result: issue
reported: "誰是臥底不要單純用打字交流吧，应該對应到該人時可以開咪講話也對"
severity: major

### 3. Existing party room keeps running under voice degradation
expected: In an already-created party room, degraded or blocked voice should disable/relabel the voice affordance and show text-only or wait guidance, while room presence, start controls, and gameplay flow still load normally.
result: pass

### 4. Deployed-stack rerun path stays trustworthy
expected: On the canonical `3100/3101` stack, rerunning the narrowed live-ops checks and `verify:release -- --skip-deploy` should stay green without ad hoc manual cleanup between suites.
result: pass

## Summary

total: 4
passed: 3
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "When a family or subsystem is degraded/blocked, the hub card and `/entry/[gameKey]/[roomNo]` should use the same degraded vocabulary, show safe actions, and prevent risky auto-enter behavior instead of failing silently."
  status: failed
  reason: "User reported: 誰是臥底不要單純用打字交流吧，应該對应到該人時可以開咪講話也對"
  severity: major
  test: 2
  artifacts: []
  missing: []
