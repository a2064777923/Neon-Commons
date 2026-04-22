# Roadmap: Hong's Neon-Commons

## Shipped Milestones

- [x] **v1.0 milestone** - shipped 2026-04-22. 7 phases, 21 plans, 50 tasks. Archives: [v1.0 roadmap](./milestones/v1.0-ROADMAP.md), [v1.0 requirements](./milestones/v1.0-REQUIREMENTS.md)

## Active Milestone: v1.1 Live Ops & Reliability

**Goal:** Deepen live room operations and single-node recovery so players can survive transient disconnects and operators can manage active rooms without direct database edits.

- **Status:** Requirements defined and roadmap initialized on 2026-04-22
- **Phases:** 4
- **Requirements coverage:** 10 / 10 mapped

### Phase 7: Session Recovery & Presence

**Goal:** Make reconnects and refreshes restore eligible room participation without inventing new per-game entry flows.
**Requirements:** ROOM-01, ROOM-02, ROOM-03

**Success Criteria:**

1. Registered players can refresh or reconnect into eligible active rooms and recover their seat/session through the shared entry contract.
2. Scoped guest identities survive disconnect and rejoin for supported room families until the room closes.
3. Hosts can distinguish connected, reconnecting, and disconnected occupants through shared room metadata and room UI.

**Plans:**

- [ ] 07-01: Extend shared identity and room-entry recovery contracts
- [ ] 07-02: Implement reconnect and rejoin handling across shipped room families
- [ ] 07-03: Surface occupant presence and recovery state in clients and regression tests

### Phase 8: Live Room Operations Surface

**Goal:** Give operators a live room directory and targeted interventions without direct DB work or whole-stack restarts.
**Requirements:** OPS-01, OPS-02, OPS-03, OPS-04

**Success Criteria:**

1. Admin surfaces list live rooms with family, occupancy, and last activity from one cross-family backend source.
2. Operators can inspect room config, occupants, and runtime health for a selected room without shell access.
3. Operators can close or drain a room and remove a disruptive occupant through audited backend actions.

**Plans:**

- [ ] 08-01: Add live room directory and room-detail admin APIs
- [ ] 08-02: Ship room-ops UI workflows and intervention actions
- [ ] 08-03: Cover room-ops permissions, audits, and regressions

### Phase 9: Single-Node Recovery Guardrails

**Goal:** Improve room lifecycle resilience within the current single-node architecture.
**Requirements:** RELY-01, RELY-02

**Success Criteria:**

1. Runtime snapshots enough room-directory metadata to rebuild active discovery after a process restart without pretending to be distributed.
2. Stale or abandoned rooms expire predictably and do not linger in discovery indefinitely.
3. Recovery and expiry behavior stays compatible with the existing hub, room-number join, and guest-claim flows.

**Plans:**

- [ ] 09-01: Persist minimal room-directory snapshot state for restart recovery
- [ ] 09-02: Add stale-room expiry and abandonment cleanup rules
- [ ] 09-03: Validate compatibility against shipped room families and admin expectations

### Phase 10: Release Verification for Live Ops

**Goal:** Extend release gates so the new live-ops and recovery surface stays shippable.
**Requirements:** RELY-03

**Success Criteria:**

1. Canonical release verification covers reconnect, operator interventions, and stale-room cleanup on the `3100/3101` stack.
2. Logic and UI smoke suites expose regressions in the new room-ops and recovery paths before ship.
3. Operator docs and planning traceability match the implemented release contract.

**Plans:**

- [ ] 10-01: Expand logic and UI critical suites for live-ops scenarios
- [ ] 10-02: Extend release verification scripts and smoke commands
- [ ] 10-03: Refresh operator docs and planning traceability for v1.1

## Requirement Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| ROOM-01 | Phase 7 | Pending |
| ROOM-02 | Phase 7 | Pending |
| ROOM-03 | Phase 7 | Pending |
| OPS-01 | Phase 8 | Pending |
| OPS-02 | Phase 8 | Pending |
| OPS-03 | Phase 8 | Pending |
| OPS-04 | Phase 8 | Pending |
| RELY-01 | Phase 9 | Pending |
| RELY-02 | Phase 9 | Pending |
| RELY-03 | Phase 10 | Pending |

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
