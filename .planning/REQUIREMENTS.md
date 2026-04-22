# Requirements: Hong's Neon-Commons

**Defined:** 2026-04-20
**Core Value:** Players can jump from the hub into stable real-time social game rooms with as little friction as possible.

## v1 Requirements

Requirements for the next active milestone. Each maps to exactly one roadmap phase.

### Platform & Contracts

- [x] **PLAT-01**: Operator can evolve frontend/backend API and socket contracts through the dedicated backend service without re-coupling feature work to page-routed APIs.

### Hub & Room Entry

- [ ] **HUB-01**: Player can discover all supported games and newly added variants from one unified hub.
- [ ] **ROOM-01**: Player can create and join expanded game rooms through a consistent room-number and lobby workflow across game families.

### Card & Party Games

- [ ] **CARD-01**: Player can use expanded Dou Dizhu rules, templates, or room interactions without regressing existing classic/social play.
- [ ] **PARTY-01**: Player can use expanded Werewolf and Avalon roles, phases, or room options through the existing live room model.

### Board Games

- [ ] **BOARD-01**: Player can use expanded Gomoku and Chinese Checkers options or interactions through the existing live board room model.

### Admin & Backend Operations

- [ ] **ADMIN-01**: Admin can manage templates, switches, or configuration that control which game capabilities are live.
- [ ] **ADMIN-02**: Admin can adjust backend runtime settings and player state from the control surface without direct database edits.

### Quality & Release Safety

- [ ] **QUAL-01**: Operator can verify critical hub, room, admin, and gameplay flows with automated checks before shipping expansions.
- [ ] **QUAL-02**: Team documentation stays accurate enough for planning, deployment, and future backend/game expansion work.

## v2 Requirements

### Platform Scaling

- **PLAT-02**: Operator can recover active room state after backend restarts or move room state beyond a single process.
- **VOIC-01**: Party-room voice can use TURN/SFU infrastructure when direct WebRTC connectivity is insufficient.

### Product Surface

- **MOBL-01**: Player can use a dedicated native mobile client experience.
- **ECON-01**: Operator can run richer seasonal economy or monetization systems beyond the current virtual-score model.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native mobile apps | Web-first experience is sufficient for the current milestone |
| Distributed room-state recovery | Important later, but not the current feature/backend expansion goal |
| Real-money payments | Not relevant to the current gameplay/backend scope |
| Dedicated voice infrastructure | Current browser P2P voice is acceptable for now |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAT-01 | Phase 1 | Complete |
| ADMIN-01 | Phase 2 | Pending |
| ADMIN-02 | Phase 2 | Pending |
| HUB-01 | Phase 3 | Pending |
| ROOM-01 | Phase 3 | Pending |
| CARD-01 | Phase 4 | Pending |
| PARTY-01 | Phase 4 | Pending |
| BOARD-01 | Phase 5 | Pending |
| QUAL-01 | Phase 6 | Pending |
| QUAL-02 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-20*
*Last updated: 2026-04-22 after Phase 1 completion*
