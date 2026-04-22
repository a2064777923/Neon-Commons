# Roadmap: Hong's Neon-Commons

## Shipped Milestones

- [x] **v1.0 milestone** - shipped 2026-04-22. 7 phases, 21 plans, 50 tasks. Archives: [v1.0 roadmap](./milestones/v1.0-ROADMAP.md), [v1.0 requirements](./milestones/v1.0-REQUIREMENTS.md)

## Current Milestone: v1.1 Live Ops & Reliability

**Goal:** Deepen live room operations and single-node recovery so players can survive transient disconnects and operators can manage active rooms without direct database edits.

- **Status:** All v1.1 requirements delivered on 2026-04-23; milestone is ready for close-out
- **Phases:** 4
- **Requirements coverage:** 10 / 10 complete

### Phase 7: Session Recovery & Presence

**Goal:** Make reconnects and refreshes restore eligible room participation without inventing new per-game entry flows.
**Requirements:** ROOM-01, ROOM-02, ROOM-03

**Success Criteria:**

1. Registered players can refresh or reconnect into eligible active rooms and recover their seat/session through the shared entry contract.
2. Scoped guest identities survive disconnect and rejoin for supported room families until the room closes.
3. Hosts can distinguish connected, reconnecting, and disconnected occupants through shared room metadata and room UI.

**Plans:**

- [x] 07-01: Extend shared identity and room-entry recovery contracts
- [x] 07-02: Implement reconnect and rejoin handling across shipped room families
- [x] 07-03: Surface occupant presence and recovery state in clients and regression tests

**Outcome:** Recovery metadata, reconnect handling, and room-page presence states are all shipped and verified across the canonical room families.

### Phase 8: Live Room Operations Surface

**Goal:** Give operators a live room directory and targeted interventions without direct DB work or whole-stack restarts.
**Requirements:** OPS-01, OPS-02, OPS-03, OPS-04

**Delivery Note:** This scope was delivered inline during Phase 10-01 because release verification could not honestly cover operator interventions until the live room surface existed.

**Success Criteria:**

1. Admin surfaces list live rooms with family, occupancy, and last activity from one cross-family backend source.
2. Operators can inspect room config, occupants, and runtime health for a selected room without shell access.
3. Operators can close or drain a room and remove a disruptive occupant through audited backend actions.

**Plans:**

- [x] 08-01: Add live room directory and room-detail admin APIs (delivered inline in 10-01)
- [x] 08-02: Ship room-ops UI workflows and intervention actions (delivered inline in 10-01)
- [x] 08-03: Cover room-ops permissions, audits, and regressions (delivered inline in 10-01)

**Outcome:** The admin console now ships live room directory/detail/action flows, occupant removal, audit hooks, and regression coverage even though the original standalone Phase 8 plan folder was never executed separately.

### Phase 9: Single-Node Recovery Guardrails

**Goal:** Improve room lifecycle resilience within the current single-node architecture.
**Requirements:** RELY-01, RELY-02

**Success Criteria:**

1. Runtime snapshots enough room-directory metadata to rebuild active discovery after a process restart without pretending to be distributed.
2. Stale or abandoned rooms expire predictably and do not linger in discovery indefinitely.
3. Recovery and expiry behavior stays compatible with the existing hub, room-number join, and guest-claim flows.

**Plans:**

- [x] 09-01: Persist minimal room-directory snapshot state for restart recovery
- [x] 09-02: Add stale-room expiry and abandonment cleanup rules
- [x] 09-03: Validate compatibility against shipped room families and admin expectations

**Outcome:** Single-node restart recovery, snapshot-only discovery, and stale-room expiry are shipped and verified.

### Phase 10: Release Verification for Live Ops

**Goal:** Extend release gates so the new live-ops and recovery surface stays shippable.
**Requirements:** RELY-03

**Success Criteria:**

1. Canonical release verification covers reconnect, operator interventions, and stale-room cleanup on the `3100/3101` stack.
2. Logic and UI smoke suites expose regressions in the new room-ops and recovery paths before ship.
3. Operator docs and planning traceability match the implemented release contract.

**Plans:**

- [x] 10-01: Expand logic and UI critical suites for live-ops scenarios
- [x] 10-02: Extend release verification scripts and smoke commands
- [x] 10-03: Refresh operator docs and planning traceability for v1.1

**Outcome:** `verify:release` now proves reconnect, operator interventions, and stale-room cleanup on the canonical `3100/3101` runtime, and repo docs/traceability match that shipped contract.

## Requirement Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| ROOM-01 | Phase 7 | Complete |
| ROOM-02 | Phase 7 | Complete |
| ROOM-03 | Phase 7 | Complete |
| OPS-01 | Phase 8 scope via Phase 10-01 | Complete |
| OPS-02 | Phase 8 scope via Phase 10-01 | Complete |
| OPS-03 | Phase 8 scope via Phase 10-01 | Complete |
| OPS-04 | Phase 8 scope via Phase 10-01 | Complete |
| RELY-01 | Phase 9 | Complete |
| RELY-02 | Phase 9 | Complete |
| RELY-03 | Phase 10 | Complete |

## Carry-Forward Themes

- Continue expanding gameplay across the shipped families without regressing live play.
- Continue expanding backend and admin capability through the dedicated backend surface.
- Keep the split frontend/backend runtime coherent as the product surface grows.
- Preserve the deployed-stack release contract around `3100/3101`.

## Backlog Parking Lot

- Distributed room-state recovery beyond the current single-node in-memory model
- TURN / SFU infrastructure for party-room voice
- Native mobile clients
- Wave 2 new-game expansion after live-ops baseline is stronger
- Richer economy and monetization systems
