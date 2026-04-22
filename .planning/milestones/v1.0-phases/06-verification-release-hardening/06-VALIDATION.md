---
phase: 06
slug: verification-release-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test + Playwright + Docker Compose + package-script release runner |
| **Config file** | `package.json` |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run verify:release` |
| **Estimated runtime** | ~240-420 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run the newest available critical suite for that wave (`npm run test:logic:critical` after Wave 1, `npm run verify:release -- --skip-deploy` after Waves 2-3)
- **Before `$gsd-verify-work`:** `npm run verify:release` must be green against the canonical `3100` runtime
- **Max feedback latency:** 420 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | QUAL-01 | T-06-01 / T-06-02 | Critical node coverage for backend, admin, hub, card, party, board, and solo logic is runnable from one named command | full node suite | `npm run test:logic:critical` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | QUAL-01 | T-06-01 / T-06-02 | Critical browser smoke covers hub, admin, card room, party, board, Reversi, Sokoban, and Undercover flows from one named command | full browser suite | `FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:critical` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | QUAL-01 | T-06-03 / T-06-04 | The canonical deployed app is rebuilt on `3100/3101` and checked for readiness before smoke verification starts | deploy + readiness | `npm run deploy:3100` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | QUAL-01 | T-06-03 / T-06-05 | One release-gate command runs check, logic, and browser suites against the freshly deployed `3100` runtime and fails loudly on any regression | full release gate | `npm run verify:release` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 3 | QUAL-02 | T-06-06 | Operator docs point at the real deploy and release commands and remain valid when the release runner is re-executed without a second redeploy | docs + command check | `npm run verify:release -- --skip-deploy` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 3 | QUAL-02 | T-06-07 | Overview, architecture, API, and planning traceability docs align with the shipped surface and hardened release contract | docs + static | `npm run check && npm run test:logic:critical` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` exposes `test:logic:critical`, `test:ui:critical`, `deploy:3100`, and `verify:release`
- [ ] `scripts/verify-release.js` (or equivalent) exists and supports deployed-stack verification

Existing node and Playwright assets cover most behaviors already; Wave 0 is about composing them into a reliable release contract.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The `3100` redeploy + release-check workflow is understandable to an operator without tribal knowledge | QUAL-02 | Command correctness alone does not prove operator clarity | Follow `docs/ops/deployment.md` from a clean shell, redeploy the app, and confirm the doc clearly explains when and why `3100` is rebuilt before smoke checks |
| The critical browser suite is still fast and stable enough to serve as a release gate | QUAL-01 | Runtime stability and perceived flake risk need human judgment after several back-to-back runs | Run `npm run verify:release` at least twice and confirm the suite ordering, progress output, and timing remain acceptable |
| Overview and architecture docs describe the shipped game surface and split-runtime verification boundary accurately | QUAL-02 | Product/document clarity is partly qualitative | Read `docs/overview/project-overview.md`, `docs/architecture/backend-contract.md`, and `docs/api/api-reference.md` after updates; confirm they match the current shipped titles and release workflow |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 420s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
