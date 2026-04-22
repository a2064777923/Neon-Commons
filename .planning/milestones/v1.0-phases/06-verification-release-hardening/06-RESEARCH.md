# Phase 6: Verification & Release Hardening - Research

**Researched:** 2026-04-22
**Domain:** Converting fragmented brownfield verification into one operator-usable release gate for the shipped Neon-Commons runtime
**Confidence:** HIGH

<user_constraints>
## User Constraints

- Phase 6 goal from `.planning/ROADMAP.md`: build enough safety around the expanded platform that future releases are verifiable instead of guess-based.
- Phase requirements are fixed as `QUAL-01` and `QUAL-02`; planning must cover both explicitly.
- `AGENTS.md` keeps the split runtime as a hard constraint: frontend remains on `3100`, backend remains on `3101`, and `/api/*` plus `/socket.io/*` stay owned by the dedicated backend.
- The user explicitly wants updated work redeployed to the canonical `3100` runtime after changes, so release hardening should treat the deployed stack as the default verification target rather than an optional final check.
- Existing shipped game/admin behavior is the compatibility baseline; Phase 6 should harden how the current surface is verified and documented, not redesign product architecture.
</user_constraints>

<current_state_audit>
## Current State Audit

### Automated coverage exists, but it is fragmented

- `test-logic/` already contains backend contract, admin, hub/room entry, card, party, board, Reversi, Sokoban, and Undercover node coverage.
- `tests/` already contains Playwright smoke flows for hub entry, admin console, card room UI, party rooms, board rooms, Reversi, Sokoban, and Undercover.
- This means the codebase already has most of the raw test assets needed for `QUAL-01`; the gap is that operators still have to know which files to compose manually.

### Package scripts do not reflect the real critical-release surface

- `npm run check` is only a file-existence sanity check in `scripts/check.js`.
- `npm run test:logic` only runs `test-logic/ddz-logic.test.js`, which no longer represents the shipped platform.
- `npm run test:ui` runs every Playwright spec, but it is not presented as a curated release gate and does not pair itself with the required node suites.
- There is no single `verify:release`-style command that operators can run before shipping.

### Deployment verification is still under-documented and easy to get wrong

- `docs/ops/deployment.md` still documents a narrow verification set centered on `backend-contract`, `client-network-contract`, and `tests/room-ui.spec.js`.
- That doc no longer matches the shipped product surface after hub expansion, admin expansion, Wave 1 titles, Phase 4 party/card expansion, and Phase 5 board expansion.
- Prior phases already recorded a real failure mode: `3100/3101` can point at a stale Docker runtime unless `docker compose up -d --build app` is rerun before smoke verification.

### The canonical runtime target should be the deployed stack, not an ad hoc dev port

- Isolated ports such as `3200` or `4300` were useful for debugging around stale containers, but they are fallback verification targets, not the operator baseline.
- The deployment contract already treats `3100` as the frontend public port and `3101` as the backend/API/socket port.
- Phase 6 should therefore codify a release routine that rebuilds or refreshes the deployed app on `3100/3101`, waits for readiness, and then runs the curated suites against that runtime.

### Documentation and traceability have drifted behind the codebase

- `docs/overview/project-overview.md`, `docs/ops/deployment.md`, and the architecture/API docs need a verification refresh now that the product ships card, party, board, direct-launch solo, and admin surfaces together.
- `.planning/REQUIREMENTS.md` traceability still shows many already-executed requirements as `Pending`, which weakens planning trust for follow-on work.
- The Phase 4 and Phase 5 summaries already point directly at what should become the Phase 6 release gate: one combined node/Playwright pass across the expanded platform.
</current_state_audit>

<recommended_direction>
## Recommended Direction

### 1. Turn existing tests into named critical suites

Phase 6 should not start by inventing a brand-new testing strategy. It should first promote the already-valid test inventory into named critical suites:

- one node suite for shared contracts and shipped gameplay/runtime logic
- one Playwright suite for hub, admin, room, and gameplay smoke flows
- both exposed through stable `package.json` scripts

This directly satisfies the "operator can verify critical flows" portion of `QUAL-01`.

### 2. Make release verification run against the canonical deployed stack

The safest release shape is:

- redeploy the app service to `3100/3101`
- wait for frontend/backend readiness
- run `npm run check`
- run the critical node suite
- run the critical browser suite against `FRONTEND_BASE_URL=http://127.0.0.1:3100`

This protects against the stale-container failure mode seen in earlier phases and aligns with the user's requirement to keep `3100` current after updates.

### 3. Keep the release routine local and operator-first

There is no evidence in the repo that CI/CD infrastructure is already the project norm. The pragmatic Phase 6 move is therefore:

- local Docker Compose redeploy
- local node/playwright release gate
- clear terminal output and non-zero exit status on failure

This is enough to make releases repeatable without creating a larger infrastructure project.

### 4. Refresh docs only after the release gate is real

Docs should follow the implemented commands, not precede them. The correct ordering is:

1. define the critical suites
2. wire the deploy + release verification command
3. update deployment/overview/architecture/API/planning docs to point at the real commands

### 5. Use Phase 6 to close documentation trust gaps

Besides operator-facing deployment docs, Phase 6 should also refresh planning traceability where it has clearly drifted from executed work. That keeps future planning honest and directly supports `QUAL-02`.
</recommended_direction>

<phase_shape_recommendation>
## Recommended Phase Shape

Use the roadmap's **3 plans** in strict sequence:

1. **06-01: Expand automated logic and smoke coverage for critical flows**
   - promote existing test inventory into named critical suites
   - tighten any unstable or missing release-critical assertions discovered during the audit

2. **06-02: Add release validation and regression-check routines**
   - codify canonical `3100` redeploy
   - add readiness checks plus one release verification command

3. **06-03: Refresh operational and planning docs after the hardening pass**
   - update deployment/overview/architecture/API docs
   - refresh planning traceability and release notes to match the hardened workflow

Recommended execution order:

- Run **06-01** first because Phase 6 needs stable named suites before it can compose a release gate.
- Run **06-02** second because the release runner depends on the curated suites from 06-01.
- Run **06-03** last because docs should reflect the final commands and verification contract, not placeholders.
</phase_shape_recommendation>

## Validation Architecture

### Fast feedback

- `npm run check`

### Wave-level validation

- `npm run test:logic:critical`
- `FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:critical`

### High-risk release validation

- `npm run verify:release`

### Expected artifacts

- named `package.json` scripts for critical logic/UI verification
- a release verification runner that redeploys or refreshes the canonical `3100` stack
- operator docs that point at the real deploy and release commands
- refreshed planning/doc traceability that matches the shipped product surface

## Open Questions

1. **Should Phase 6 add CI/CD infrastructure?**
   - What we know: the repo already uses Docker Compose, local scripts, node tests, and Playwright, but there is no established CI contract in this milestone.
   - Recommendation: no. Keep Phase 6 local/operator-first.

2. **Should final smoke verification default to isolated debug ports?**
   - What we know: debug ports were necessary when `3100` was stale, but the product deployment contract is still `3100/3101`.
   - Recommendation: no. Use `3100` as the canonical target and keep alternate ports only as debugging escape hatches.

3. **Should docs refresh include planning traceability files?**
   - What we know: `.planning/REQUIREMENTS.md` status drift already exists and can mislead future planning.
   - Recommendation: yes. Refresh the minimal planning artifacts that directly affect future workflow trust.

<sources>
## Sources

### Primary (HIGH confidence)
- `package.json`
- `scripts/check.js`
- `scripts/run-stack.js`
- `docs/ops/deployment.md`
- `tests/hub-entry.spec.js`
- `tests/admin-console.spec.js`
- `tests/room-ui.spec.js`
- `tests/arcade-party.spec.js`
- `tests/board-games.spec.js`
- `tests/reversi.spec.js`
- `tests/sokoban.spec.js`
- `tests/undercover.spec.js`
- `test-logic/backend-contract.test.js`
- `test-logic/backend-cors.test.js`
- `test-logic/admin-control-plane.test.js`
- `test-logic/hub-room-entry.test.js`
- `test-logic/ddz-logic.test.js`
- `test-logic/party-config.test.js`
- `test-logic/board-config.test.js`
- `test-logic/chinesecheckers-logic.test.js`
- `test-logic/reversi-logic.test.js`
- `test-logic/sokoban-logic.test.js`
- `test-logic/undercover-logic.test.js`

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/PROJECT.md`
- `.planning/phases/04-card-party-gameplay-expansion/04-03-SUMMARY.md`
- `.planning/phases/05-board-gameplay-expansion/05-01-SUMMARY.md`
- `.planning/phases/05-board-gameplay-expansion/05-02-SUMMARY.md`
- `AGENTS.md`
</sources>
