# Requirements: Hong's Neon-Commons

**Defined:** 2026-04-23
**Core Value:** Players can jump from the hub into stable real-time social game rooms with as little friction as possible.

## v1.2 Requirements

### Availability & Operations

- [ ] **AVAIL-01**: Player can see when room or voice service is degraded and what actions remain safe instead of hitting a silent failure.
- [ ] **AVAIL-02**: Operator can inspect realtime, room-entry, and voice health from the admin surface without shell access.
- [ ] **AVAIL-03**: Operator can place selected subsystems or game families into a controlled degraded mode so healthy rooms keep running while risky entry paths pause.

### Voice Reliability

- [ ] **VOICE-01**: Party room voice can fall back to a relay-assisted path when direct peer connectivity fails.
- [ ] **VOICE-02**: Player can recover voice connectivity during transient network changes without rejoining the room manually.

### Wave 2 Content

- [ ] **WAVE-01**: Player can discover second-wave games from the hub with accurate rollout state, availability, and room-entry behavior.
- [ ] **WAVE-02**: Player can create or join the first wave-2 room-based title through the shared room-number, invite, recovery, and admin capability flows.
- [ ] **WAVE-03**: Player can create or join the second wave-2 title without regressing existing families or the admin rollout model.

### Admin & Rollout

- [ ] **ADMIN-01**: Operator can manage wave-2 game rollout and availability from the existing backend-owned admin surface without code edits.
- [ ] **ADMIN-02**: Operator can audit degraded-mode, voice, and rollout interventions through the same recent-change trail.

## v2 Requirements

### Platform Scale

- **SCALE-01**: Runtime can recover and rebalance live rooms across multiple backend instances.
- **SCALE-02**: Room traffic can move off the current in-memory single-node model without breaking room-number join flow.

### Media Platform

- **MEDIA-01**: Voice can move from relay fallback to a dedicated SFU/media service when room counts exceed peer-to-peer limits.

### Content Expansion

- **CONTENT-01**: A third content wave can ship without new per-title launch plumbing.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full multi-node room migration | Too much runtime contract change for this milestone; v1.2 should harden degraded modes and operator control first. |
| Dedicated SFU media platform | This milestone is about voice reliability and fallback, not a full media-stack replatform. |
| Native mobile app | Web remains the shipping focus while availability work is still deepening. |
| Economy / monetization expansion | Not aligned with the current availability-first milestone goal. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

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

**Coverage:**
- v1.2 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-23*
*Last updated: 2026-04-23 after milestone v1.2 initialization*
