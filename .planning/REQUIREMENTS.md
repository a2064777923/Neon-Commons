# Requirements: Hong's Neon-Commons

**Defined:** 2026-04-22
**Core Value:** Players can jump from the hub into stable real-time social game rooms with as little friction as possible.

## v1 Requirements

### Session Recovery

- [x] **ROOM-01**: Player can refresh or reconnect to an eligible active room and recover their seat/session without manual admin help.
- [x] **ROOM-02**: Guest player can rejoin an eligible party or board room with their scoped guest identity intact until the room closes.
- [x] **ROOM-03**: Room host can see whether an occupant is connected, reconnecting, or disconnected before removing them.

### Live Operations

- [x] **OPS-01**: Operator can view a live cross-family room directory with family, occupancy, and last-activity status.
- [x] **OPS-02**: Operator can inspect an active room's config, occupants, and runtime health without database access.
- [x] **OPS-03**: Operator can close or drain a stuck room through the admin surface without restarting the whole stack.
- [x] **OPS-04**: Operator can remove a disruptive guest or player from a room through an explicit admin action with auditability.

### Single-Node Reliability

- [x] **RELY-01**: Runtime can persist enough room-directory metadata to repopulate active-room discovery after a single-node restart.
- [x] **RELY-02**: Runtime can expire stale rooms predictably when all occupants are gone or never return after disconnect.
- [x] **RELY-03**: Release verification proves reconnect, room intervention, and stale-room cleanup on the canonical `3100/3101` stack.

## v2 Requirements

### Platform Scale

- **SCALE-01**: Runtime can recover live rooms across multiple backend instances.
- **SCALE-02**: Room traffic can move off the current in-memory single-node model without breaking room-number join flow.

### Voice

- **VOICE-01**: Party rooms can fall back to TURN relay when direct peer connectivity fails.

### Content Expansion

- **CONTENT-01**: Hub can ship a second wave of new games without manual capability-flag wiring.
- **CONTENT-02**: Existing live games can add richer progression or economy loops.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-node distributed room recovery | Larger architecture step than v1.1; keep this milestone single-node. |
| TURN / SFU voice infrastructure | Separate platform investment and not required for the live-ops baseline. |
| Wave 2 new-game delivery | v1.1 is for operational depth and reliability before another content wave. |
| Native mobile app | Web runtime remains the shipping focus. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ROOM-01 | Phase 7 | Complete |
| ROOM-02 | Phase 7 | Complete |
| ROOM-03 | Phase 7 | Complete |
| OPS-01 | Phase 8 scope delivered via Phase 10-01 | Complete |
| OPS-02 | Phase 8 scope delivered via Phase 10-01 | Complete |
| OPS-03 | Phase 8 scope delivered via Phase 10-01 | Complete |
| OPS-04 | Phase 8 scope delivered via Phase 10-01 | Complete |
| RELY-01 | Phase 9 | Complete |
| RELY-02 | Phase 9 | Complete |
| RELY-03 | Phase 10 | Complete |

**Coverage:**
- v1 requirements: 10 total
- Mapped to phases: 10
- Complete: 10 / 10 ✓
- Unmapped: 0 ✓

**Traceability note:** the original standalone Phase 8 room-ops plan was absorbed into Phase 10-01 because truthful release verification required the operator surface to exist first. Requirement status follows shipped artifacts and summaries, not only the initial ordering.

---
*Requirements defined: 2026-04-22*
*Last updated: 2026-04-23 after Phase 10 release verification and docs sync*
