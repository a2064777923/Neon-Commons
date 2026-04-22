# Phase 10: Release Verification for Live Ops - Research

**Researched:** 2026-04-22
**Domain:** Extending the canonical `3100/3101` release gate so live-ops and single-node recovery regressions fail before ship
**Confidence:** MEDIUM-HIGH

<user_constraints>
## User Constraints

- Phase 10 goal from `.planning/ROADMAP.md`: extend release gates so the new live-ops and recovery surface stays shippable.
- Phase 10 must satisfy `RELY-03` from `.planning/REQUIREMENTS.md`: release verification must prove reconnect, room intervention, and stale-room cleanup on the canonical `3100/3101` stack.
- `AGENTS.md` keeps the split runtime as a hard contract: frontend remains on `3100`, backend remains on `3101`, and backend owns `/api/*` and `/socket.io/*`.
- Existing gameplay, hub entry, and admin behavior are the compatibility baseline; this phase should harden verification and documentation around the shipped surface instead of reworking the product architecture.
- The user wants updates redeployed onto the canonical `3100` runtime, so Phase 10 should continue treating `npm run deploy:3100` plus `npm run verify:release` as the operator baseline rather than a fallback path.
</user_constraints>

<current_state_audit>
## Current State Audit

### Canonical release commands already exist, but they do not yet prove the new reliability surface

- `package.json` already exposes `deploy:3100`, `test:logic:critical`, `test:ui:critical`, and `verify:release`.
- `scripts/verify-release.js` already redeploys `docker compose up -d --build app`, waits for `http://127.0.0.1:3100/login` and `http://127.0.0.1:3101/api/hub`, then runs `npm run check`, `npm run test:logic:critical`, and `npm run test:ui:critical`.
- This means Phase 10 should extend an existing operator contract, not invent a brand-new release runner.

### The current critical logic gate misses key Phase 7 and Phase 9 regressions

- `test:logic:critical` currently includes shared backend/admin/hub/game logic suites, but it does **not** include:
  - `test-logic/session-recovery.test.js`
  - `test-logic/room-directory-persistence.test.js`
  - `test-logic/room-expiry.test.js`
- Those omitted suites are exactly where the deterministic reconnect lifecycle, snapshot reload, and stale-room expiry guarantees live.
- `test-logic/hub-room-entry.test.js` already covers some recovery-facing contract behavior, including `snapshot-only` discovery, but it does not replace the manager-level timing and persistence coverage in the omitted suites.

### The current critical UI gate still reflects pre-live-ops smoke coverage

- `test:ui:critical` currently runs `tests/hub-entry.spec.js`, `tests/admin-console.spec.js`, `tests/room-ui.spec.js`, `tests/arcade-party.spec.js`, `tests/board-games.spec.js`, `tests/reversi.spec.js`, `tests/sokoban.spec.js`, and `tests/undercover.spec.js`.
- `tests/hub-entry.spec.js` currently proves homepage family state and one guest invite deep link, but it does not exercise the new recovery-only entry messaging or a `snapshot-only` discovery path.
- `tests/admin-console.spec.js` currently covers grouped family toggles and template editing, but it does not cover live-room directory inspection, room drain/close actions, or occupant removal.
- Because Phase 8 is not implemented yet, the release gate cannot honestly claim room-intervention coverage today. Phase 10 therefore needs explicit dependency handling for the future Phase 8 surface.

### Phase 10 depends on both Phase 8 and Phase 9 artifacts, even if it is planned before Phase 8 executes

- Phase 9 is now the source of reconnect, recovery visibility, `snapshot-only` behavior, and stale-room cleanup contracts.
- Phase 8 is supposed to provide the live room directory and operator intervention surface that Phase 10 must verify.
- Planning Phase 10 now is still useful, but the plans should explicitly depend on:
  - Phase 9 artifacts for recovery/expiry assertions
  - Phase 8 artifacts for operator intervention smoke and release checks

### Operator documentation is only partially aligned with the upcoming release contract

- `docs/ops/deployment.md` already documents the canonical release commands well.
- `docs/admin/admin-guide.md` is still narrow; it only covers player management, template management, and system config. It does not mention live room operations, recovery-oriented verification, or the canonical release routine.
- Planning traceability still lags execution state: `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md` still show completed Phase 7 and Phase 9 work as pending.
</current_state_audit>

<recommended_direction>
## Recommended Direction

### 1. Extend the critical logic suite with deterministic recovery and expiry coverage

Phase 10 should treat the existing `test:logic:critical` command as the long-term release entry point, then expand its file list so it includes:

- reconnect/session lifecycle coverage from `test-logic/session-recovery.test.js`
- stale-room lifecycle coverage from `test-logic/room-expiry.test.js`
- restart snapshot reload coverage from `test-logic/room-directory-persistence.test.js`
- future Phase 8 live-ops backend tests once that phase lands

This is the lowest-friction way to satisfy the “prove reconnect and stale-room cleanup” portion of `RELY-03`.

### 2. Keep browser smoke narrow, but add one recovery path and one operator path

The current Playwright suite is already broad enough; the gap is not quantity, it is missing live-ops/recovery scenarios. The correct move is:

- extend an existing hub/entry smoke to cover recovery-only room visibility and blocked entry
- extend or add one admin smoke for live room operations once Phase 8 exists
- keep everything pointed at `FRONTEND_BASE_URL=http://127.0.0.1:3100`

This preserves smoke-test discipline while closing the new operational risk surface.

### 3. Extend `verify:release` without fragmenting the operator contract

`npm run verify:release` should remain the top-level pre-ship command. Phase 10 can improve it by:

- making recovery/live-ops stages visible in stage output
- optionally adding narrower helper commands for debugging, but not replacing the canonical command
- ensuring any new room-ops or recovery suites are wired into the same `deploy -> readiness -> check -> critical suites` chain

### 4. Document only the release workflow that is actually implemented

Once the suites and scripts are real, update:

- `docs/admin/admin-guide.md`
- `docs/ops/deployment.md`
- `docs/overview/project-overview.md`
- relevant planning traceability (`.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md` as appropriate at execution time)

Docs should follow implemented verification commands and shipped room-ops/recovery behavior, not speculative workflow text.

### 5. Treat Phase 8 dependency as explicit rather than implicit

Because room intervention coverage is part of Phase 10 success criteria, the Phase 10 plans should declare explicit dependencies on Phase 8 and Phase 9. That prevents the release plan from silently asserting coverage for an operator surface that does not exist yet.
</recommended_direction>

<phase_shape_recommendation>
## Recommended Phase Shape

Keep the roadmap's **3 plans**, but write them so the dependency chain is explicit:

1. **10-01: Expand logic and UI critical suites for live-ops scenarios**
   - extend existing critical commands with recovery, stale-room, and future room-ops suites
   - tighten current browser smoke around recovery-only entry semantics on `3100`

2. **10-02: Extend release verification scripts and smoke commands**
   - keep `npm run verify:release` as the canonical entry point
   - expose clearer stage output and any necessary helper commands around the expanded suites

3. **10-03: Refresh operator docs and planning traceability for v1.1**
   - update operator/admin/deployment docs only after the commands are real
   - refresh v1.1 planning traceability so completed and verified work is no longer shown as pending

Recommended execution order:

- Run **10-01** after Phase 8 and Phase 9 artifacts are available.
- Run **10-02** after the widened suites are green locally.
- Run **10-03** last so docs and planning state reflect the final release contract.
</phase_shape_recommendation>

## Validation Architecture

### Fast feedback

- `npm run check`

### Wave-level validation

- `node --test test-logic/session-recovery.test.js test-logic/room-directory-persistence.test.js test-logic/room-expiry.test.js test-logic/hub-room-entry.test.js`
- `FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/hub-entry.spec.js tests/admin-console.spec.js --workers=1`

### High-risk release validation

- `npm run verify:release`
- `npm run verify:release -- --skip-deploy`

### Expected artifacts

- expanded `test:logic:critical` coverage for recovery, expiry, and room-ops regressions
- expanded `test:ui:critical` coverage for recovery-only entry and operator interventions
- release runner output and helper commands that still center the canonical `3100/3101` stack
- docs and planning traceability that describe the real release gate and current v1.1 completion state

## Open Questions

1. **Should Phase 10 add brand-new top-level release commands?**
   - What we know: `deploy:3100` and `verify:release` already exist and are documented.
   - Recommendation: no major command churn. Extend the existing commands first, and add only narrow helper commands if they improve diagnosis.

2. **Should recovery verification rely only on browser smoke?**
   - What we know: reconnect grace, snapshot reload, and stale-room expiry are easier to assert deterministically in node tests.
   - Recommendation: no. Keep deterministic lifecycle checks in node tests, then use one or two browser smokes for user-visible recovery affordances.

3. **How should planning handle Phase 8 still being unexecuted?**
   - What we know: room interventions are a Phase 10 requirement, but the Phase 8 room-ops surface is not on disk yet.
   - Recommendation: plan now with explicit `depends_on` on Phase 8 and Phase 9, then execute Phase 10 only after Phase 8 ships.

<sources>
## Sources

### Primary (HIGH confidence)
- `package.json`
- `scripts/verify-release.js`
- `docs/ops/deployment.md`
- `docs/admin/admin-guide.md`
- `tests/hub-entry.spec.js`
- `tests/admin-console.spec.js`
- `test-logic/hub-room-entry.test.js`
- `test-logic/session-recovery.test.js`
- `test-logic/room-directory-persistence.test.js`
- `test-logic/room-expiry.test.js`
- `AGENTS.md`

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/PROJECT.md`
- `.planning/phases/09-single-node-recovery-guardrails/09-03-SUMMARY.md`
- `.planning/milestones/v1.0-phases/06-verification-release-hardening/06-RESEARCH.md`
- `.planning/milestones/v1.0-phases/06-verification-release-hardening/06-VALIDATION.md`
</sources>
