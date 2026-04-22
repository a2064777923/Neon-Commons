# Roadmap: Hong's Neon-Commons

## Shipped Milestones

- [x] **v1.1 Live Ops & Reliability** - shipped 2026-04-23. 4 phases, 9 plans, 18 tasks. Archives: [v1.1 roadmap](./milestones/v1.1-ROADMAP.md), [v1.1 requirements](./milestones/v1.1-REQUIREMENTS.md)
- [x] **v1.0 milestone** - shipped 2026-04-22. 7 phases, 21 plans, 50 tasks. Archives: [v1.0 roadmap](./milestones/v1.0-ROADMAP.md), [v1.0 requirements](./milestones/v1.0-REQUIREMENTS.md)

## Current Milestone: v1.2 大跃进

**Goal:** Push the platform toward higher availability while shipping a second wave of games, more reliable voice, and stronger backend/admin operating leverage.

- **Status:** Requirements defined and roadmap initialized on 2026-04-23
- **Phases:** 6
- **Requirements coverage:** 10 / 10 mapped

### Phase 11: Availability Signals & Degraded Modes

**Goal:** Make degraded realtime and voice conditions explicit, then let operators limit risky flows without taking the whole stack down.
**Requirements:** AVAIL-01, AVAIL-03

**Success Criteria:**

1. Players see clear degraded-state messaging instead of silent room-entry or voice failures.
2. Operators can put selected subsystems or game families into a controlled degraded mode while healthy rooms continue running.
3. Hub, entry, room, and admin surfaces all use the same degraded-state vocabulary and behavior.

**Plans:**

- [ ] 11-01: Define shared availability and degraded-mode contracts across backend and client payloads
- [ ] 11-02: Implement degraded-mode runtime controls, entry gating, and player-facing messaging
- [ ] 11-03: Verify degraded-state behavior across critical room-entry and release flows

### Phase 12: Voice Reliability Foundation

**Goal:** Make party-room voice recover more reliably when peer-to-peer connectivity degrades.
**Requirements:** VOICE-01, VOICE-02

**Success Criteria:**

1. Party-room voice can fall back to a relay-assisted path when direct connectivity fails.
2. Players can recover voice after transient network changes without manual room rejoin.
3. Voice reliability changes stay compatible with existing party-room signaling and room lifecycle behavior.

**Plans:**

- [ ] 12-01: Introduce relay/fallback voice transport contracts and configuration
- [ ] 12-02: Implement reconnect and fallback handling in party rooms and signaling paths
- [ ] 12-03: Add diagnostics and regression coverage for voice degradation and recovery

### Phase 13: Admin HA & Rollout Control Plane

**Goal:** Expand the backend-owned admin surface so operators can inspect health, manage rollout, and audit interventions.
**Requirements:** AVAIL-02, ADMIN-01, ADMIN-02

**Success Criteria:**

1. Operators can inspect realtime, room-entry, and voice health from the admin surface without shell access.
2. Operators can manage wave-2 rollout and availability from backend-owned controls instead of code edits.
3. Voice, degraded-mode, and rollout interventions appear in the same recent-change trail with enough detail to audit later.

**Plans:**

- [ ] 13-01: Extend admin APIs for runtime health, voice diagnostics, and rollout state
- [ ] 13-02: Build admin console workflows for degraded mode, rollout control, and audit review
- [ ] 13-03: Cover permissions, diagnostics, and audit semantics for HA/admin operations

### Phase 14: Wave 2 Launch Contract

**Goal:** Prepare the hub and room framework so Wave 2 titles can launch without bespoke discovery plumbing.
**Requirements:** WAVE-01

**Success Criteria:**

1. The hub can expose Wave 2 titles with accurate rollout, availability, and entry behavior.
2. Shared room-entry and admin capability paths can stage new titles without one-off wiring.
3. Wave 2 launch metadata stays compatible with existing recovery, rollout, and release contracts.

**Plans:**

- [ ] 14-01: Extend shared metadata, rollout, and launch contracts for Wave 2 titles
- [ ] 14-02: Update hub, entry, and capability surfaces for staged Wave 2 discovery

### Phase 15: Wave 2 Delivery Set A

**Goal:** Ship the first Wave 2 room-based title on top of the shared launch and recovery contract.
**Requirements:** WAVE-02

**Success Criteria:**

1. Players can create and join the first Wave 2 title through room number, invite, and recovery flows.
2. The title inherits admin capability controls, degraded-mode handling, and release coverage from the shared platform.
3. Existing shipped families continue to behave correctly after the new title lands.

**Plans:**

- [ ] 15-01: Implement the first Wave 2 title's runtime, rules, and shared room integration
- [ ] 15-02: Ship UI, entry, admin hooks, and regression coverage for the first Wave 2 title

### Phase 16: Wave 2 Delivery Set B & Milestone Hardening

**Goal:** Ship the second Wave 2 title and fold all new voice, availability, and content surfaces into the canonical release gate.
**Requirements:** WAVE-03

**Success Criteria:**

1. Players can create and join the second Wave 2 title without regressing existing families or rollout controls.
2. Canonical verification covers the new voice reliability, degraded-mode, and Wave 2 game surfaces on `3100/3101`.
3. Operator docs and planning traceability stay aligned with the final milestone contract.

**Plans:**

- [ ] 16-01: Implement the second Wave 2 title on the shared launch contract
- [ ] 16-02: Expand critical suites, release routines, and docs for Wave 2 plus HA/voice changes

## Requirement Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| AVAIL-01 | Phase 11 | Pending |
| AVAIL-02 | Phase 13 | Pending |
| AVAIL-03 | Phase 11 | Pending |
| VOICE-01 | Phase 12 | Pending |
| VOICE-02 | Phase 12 | Pending |
| WAVE-01 | Phase 14 | Pending |
| WAVE-02 | Phase 15 | Pending |
| WAVE-03 | Phase 16 | Pending |
| ADMIN-01 | Phase 13 | Pending |
| ADMIN-02 | Phase 13 | Pending |

## Carry-Forward Themes

- Continue expanding gameplay across the shipped families without regressing live play.
- Continue expanding backend and admin capability through the dedicated backend surface.
- Keep the split frontend/backend runtime coherent as the product surface grows.
- Preserve the deployed-stack release contract around `3100/3101`.
- Move toward higher availability through explicit degradation handling and stronger operator control, not by overpromising full distributed recovery too early.

## Backlog Parking Lot

- Full multi-node room recovery and live room migration
- Dedicated SFU media platform beyond fallback voice reliability
- Native mobile clients
- Wave 3 new-game expansion after Wave 2 stabilizes
- Richer economy and monetization systems
