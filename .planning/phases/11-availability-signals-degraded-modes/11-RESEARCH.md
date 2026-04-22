# Phase 11: Availability Signals & Degraded Modes - Research

**Researched:** 2026-04-23
**Domain:** Unifying brownfield availability and degraded-mode behavior across hub, room entry, party-room voice, and the backend-owned admin runtime surface
**Confidence:** HIGH

<user_constraints>
## User Constraints

- Phase 11 must satisfy `AVAIL-01` and `AVAIL-03` from `.planning/REQUIREMENTS.md`: players need explicit degraded-state messaging, and operators need controlled degraded mode for selected subsystems or families without stopping healthy rooms.
- `AGENTS.md` keeps the split runtime locked: frontend stays on `3100`, backend stays on `3101`, and the dedicated backend continues owning `/api/*` plus `/socket.io/*`.
- Existing shipped room-number join flow, hub discovery, live Socket.IO room behavior, and the brownfield admin console are the compatibility target. Phase 11 must extend them, not replace them.
- The milestone direction explicitly avoids overpromising full distributed recovery. Degraded mode should be an honest operator-control and messaging layer, not a fake HA/failover story.
- Voice work in this phase is about reliability signaling and controlled fallback behavior, not TURN/SFU or a new media platform. Those remain deferred or belong to Phase 12.
- The user wants meaningful updates redeployed against the canonical `3100` stack, so planning should keep `npm run deploy:3100`, `npm run test:logic:liveops`, `npm run test:ui:liveops`, and `npm run verify:release` as the release-facing contract.

</user_constraints>

<current_state_audit>
## Current State Audit

### What already works

1. **Room-level availability already exists and is truthful.**
   - `lib/rooms/directory.js` already distinguishes `live` from `snapshot-only`.
   - `lib/admin/live-room-ops.js` and the room managers already distinguish `live`, `draining`, and `closed`.
   - Card, party, and board room serializers already expose room availability in their detail payloads.

2. **Operator controls already exist, but only for new-room creation.**
   - `lib/admin/control-plane.js` already persists capability toggles and `maintenanceMode`.
   - `/api/admin/runtime` and `pages/admin/index.js` already provide a backend-owned runtime control surface.
   - `admin_logs` already record runtime changes and live-room interventions.

3. **Player-facing recovery messaging is already proven for `snapshot-only`.**
   - `backend/handlers/hub.js` and `backend/handlers/room-entry/resolve.js` already serialize recovery-aware room-entry payloads.
   - `pages/index.js` and `pages/entry/[gameKey]/[roomNo].js` already surface snapshot-only messaging instead of silent failure.
   - `test-logic/hub-room-entry.test.js` and `tests/hub-entry.spec.js` already lock that behavior down.

4. **Party-room voice already has a working signaling baseline.**
   - `lib/socket-server.js` already owns `voice:*` signaling events.
   - `pages/party/[roomNo].js` already handles `getUserMedia`, `RTCPeerConnection`, and local voice error display.
   - Phase 12 can build on this instead of inventing a second voice runtime.

### Gaps that still block Phase 11

1. **There is no shared degraded-mode vocabulary across surfaces.**
   - Current room `availability` covers room-instance truth (`live`, `snapshot-only`, `draining`, `closed`), but it cannot express service conditions like "voice degraded but room still playable" or "entry blocked while existing rooms stay healthy".

2. **Runtime controls cannot target selected subsystems or families.**
   - Today the control plane can only pause all new rooms or disable new-room creation per game key.
   - That is insufficient for scoped degraded mode such as "party voice degraded" or "board entry blocked while live board rooms continue".

3. **Voice degradation is still mostly local UI error handling.**
   - `pages/party/[roomNo].js` can say "microphone permission unavailable", but there is no backend-authored voice status contract that the hub, entry page, admin page, and room page can all agree on.

4. **Admin and player surfaces do not currently share the same safe-action guidance.**
   - Hub cards, room-entry pages, live-room admin detail, and voice UI all use separate copy and separate status logic.
   - That makes it easy for degraded-mode behavior to drift or silently conflict.

### Important landmines

- **Do not overload room availability enums with subsystem degradation.**
  `snapshot-only`, `draining`, and `closed` are already truthful room-state semantics and should stay intact.

- **Do not turn Phase 11 into a full health-observability platform.**
  Broader admin health inspection belongs to Phase 13. Phase 11 should create the contract and the scoped operator controls, not a whole monitoring system.

- **Do not block healthy live rooms when only risky entry paths need to pause.**
  The milestone goal is controlled degradation, not broad shutdown.

- **Do not let the frontend invent its own degraded vocabulary.**
  The backend must stay source-of-truth, with shared helpers reused by both server and client.

- **Do not imply that voice degradation equals room failure.**
  A party room can remain playable with text/chat and game actions even if voice is degraded or blocked.

</current_state_audit>

<recommended_direction>
## Recommended Direction

### 1. Keep room availability and degraded mode as two separate layers

Phase 11 should preserve the existing room-layer contract:

- `live`
- `snapshot-only`
- `draining`
- `closed`

Then add a second additive service/degraded envelope for:

- `entry`
- `realtime`
- `voice`

Recommended subsystem states:

- `healthy`
- `degraded`
- `blocked`

The shared contract should also carry:

- a stable reason code
- a short label/message
- safe actions such as `wait`, `retry`, `join-existing`, `share-link`, `continue-text-only`
- scope metadata such as global vs affected families

This avoids conflating "the room is a recovery snapshot" with "the service is intentionally degraded".

### 2. Extend the existing admin runtime control plane instead of inventing a new one

The repo already has the right backbone:

- `system_configs`
- `lib/admin/control-plane.js`
- `/api/admin/runtime`
- `pages/admin/index.js`
- `admin_logs`

Phase 11 should add one structured degraded-mode object on top of that existing surface, rather than a brand-new API family. Recommended shape:

- one backend-owned `availabilityControls` or similarly named object
- subsystem-level state for `entry`, `realtime`, and `voice`
- optional family scoping for `card`, `party`, and `board`
- operator reason/audit metadata flowing through the existing runtime PATCH and audit log path

That gives Phase 11 a bounded admin implementation while leaving Phase 13 room to expand inspection and diagnostics.

### 3. Compute effective status through one shared helper module

Recommended new shared helper area:

- `lib/shared/availability.js`

That module should centralize:

- enum constants
- normalization for degraded-mode control payloads
- scope matching for affected families/games
- serialization helpers that produce one stable client-facing envelope

Backend handlers and frontend pages should both read from that shared contract so the hub, entry page, party room, and admin page all render the same semantics.

### 4. Treat voice as a first-class degraded subsystem, not a generic local error

Phase 11 should give the party room a backend-authored voice status object even before Phase 12 adds transport fallback. Recommended behavior:

- if voice is `degraded`, keep room gameplay live and show the same shared warning/status vocabulary
- if voice is `blocked`, keep the room playable but steer players toward text-only safe actions
- local device errors can still add detail, but they should sit on top of the shared backend-authored status instead of replacing it

This gives Phase 12 a clean contract to extend later.

### 5. Use Phase 11 to create a reusable milestone foundation

The contract defined here should be reusable for:

- Phase 12 voice fallback/reconnect work
- Phase 13 admin health and rollout inspection
- Phase 14-16 Wave 2 games, which will need shared availability and rollout metadata

Phase 11 should therefore optimize for a small number of honest, reusable primitives rather than one-off UI copy.

</recommended_direction>

<phase_shape_recommendation>
## Recommended Phase Shape

Keep the roadmap's **3 plans** exactly as written:

1. **11-01: Define shared availability and degraded-mode contracts across backend and client payloads**
   - shared enums, payload helpers, and backward-compatible additive fields
   - no route churn, no UI reinvention

2. **11-02: Implement degraded-mode runtime controls, entry gating, and player-facing messaging**
   - admin runtime editing and audit semantics
   - hub, entry, and party-room messaging/gating
   - healthy rooms keep running while risky paths pause

3. **11-03: Verify degraded-state behavior across critical room-entry and release flows**
   - precedence and compatibility tests
   - widen `liveops` helper commands if needed
   - prove the canonical `3100/3101` release flow still covers the new surface

Recommended execution order:

- **11-01 first** because every other change depends on one stable vocabulary.
- **11-02 second** because runtime controls and UI behavior should consume that contract, not redefine it.
- **11-03 last** so the widened helper/release suites lock the final semantics, not an earlier draft.

</phase_shape_recommendation>

## Validation Architecture

### Fast feedback

- `npm run check`
- `node --test test-logic/admin-control-plane.test.js test-logic/hub-room-entry.test.js`

### Wave-level validation

- `npm run test:logic:liveops`
- `FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:liveops`
- `FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/arcade-party.spec.js --workers=1`

### High-risk release validation

- `npm run verify:release -- --skip-deploy`
- `npm run verify:release`

### Expected artifacts

- one shared availability/degraded-mode helper module reused by backend and frontend
- additive hub / room-entry / room-detail payload fields that keep room availability and degraded subsystem state separate
- admin runtime controls and audit semantics for scoped degraded mode
- stable player-facing degraded messaging on hub, entry, and party-room voice surfaces
- widened node/browser release coverage for degraded-state precedence and healthy-room continuity

## Open Questions

1. **Should degraded mode live inside `runtimeControls` or beside it?**
   - What we know: the existing admin surface, audit flow, and persistence model already revolve around `/api/admin/runtime`.
   - Recommendation: keep the runtime endpoint, but add a separate structured `availabilityControls` object inside the same backend-owned surface rather than stuffing subsystem state into the legacy scalar controls.

2. **Should Phase 11 target game keys or game families?**
   - What we know: the requirement says "selected subsystems or game families", and the current brownfield product already groups most operational behavior by family.
   - Recommendation: support family scope first (`card`, `party`, `board`) plus global defaults. Leave per-game overrides to later phases unless a concrete need appears during execution.

3. **Should voice degradation ever block room join?**
   - What we know: Phase 11 is about making risk explicit while healthy rooms keep running.
   - Recommendation: no. Voice degradation should steer party rooms toward text-only or retry behavior while entry/realtime controls decide whether joins are paused.

<sources>
## Sources

### Primary (HIGH confidence)
- `lib/admin/control-plane.js`
- `lib/admin/live-room-ops.js`
- `lib/rooms/directory.js`
- `lib/socket-server.js`
- `backend/handlers/admin/runtime/index.js`
- `backend/handlers/hub.js`
- `backend/handlers/room-entry/resolve.js`
- `backend/handlers/rooms/[roomNo]/index.js`
- `backend/handlers/party/rooms/[roomNo]/index.js`
- `backend/handlers/board/rooms/[roomNo]/index.js`
- `pages/index.js`
- `pages/entry/[gameKey]/[roomNo].js`
- `pages/party/[roomNo].js`
- `pages/admin/index.js`
- `test-logic/admin-control-plane.test.js`
- `test-logic/hub-room-entry.test.js`
- `test-logic/live-room-ops.test.js`
- `tests/hub-entry.spec.js`
- `tests/admin-console.spec.js`
- `docs/architecture/backend-contract.md`

### Secondary (MEDIUM confidence)
- `.planning/PROJECT.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/milestones/v1.1-phases/09-single-node-recovery-guardrails/09-03-SUMMARY.md`
- `.planning/milestones/v1.1-phases/10-release-verification-for-live-ops/10-01-SUMMARY.md`
- `.planning/milestones/v1.1-phases/10-release-verification-for-live-ops/10-02-SUMMARY.md`
- `AGENTS.md`

</sources>
