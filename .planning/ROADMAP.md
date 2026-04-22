# Roadmap: Hong's Neon-Commons

## Overview

This roadmap treats the current shipped arcade and admin stack as the protected baseline, then builds outward in a controlled order: first harden the separated backend contract, then expand the admin/backend control plane, then widen the game hub and room framework, and finally ship deeper gameplay expansion with hardening and verification at the end.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Backend Contract Foundation** - Stabilize the dedicated backend service boundary and shared client contract
- [x] **Phase 2: Admin Control Plane Expansion** - Expand backend-facing admin capabilities and operational control
- [ ] **Phase 3: Hub & Room Expansion Framework** - Prepare the hub and room lifecycle for additional game/variant surface area
- [ ] **Phase 4: Card & Party Gameplay Expansion** - Extend Dou Dizhu, Werewolf, and Avalon gameplay safely
- [ ] **Phase 5: Board Gameplay Expansion** - Extend Gomoku and Chinese Checkers capability safely
- [ ] **Phase 6: Verification & Release Hardening** - Lock in regression coverage, docs, and release confidence

## Phase Details

### Phase 1: Backend Contract Foundation
**Goal**: Make the separated backend service the durable contract layer for future feature work.
**Depends on**: Nothing (first phase)
**Requirements**: [PLAT-01]
**Success Criteria** (what must be TRUE):
  1. Frontend REST and socket access go through a shared backend-aware client path.
  2. Backend handler boundaries are explicit enough that future feature work no longer depends on `pages/api`.
  3. Planning and deployment docs reflect the real separated runtime model.
**Plans**: 3 plans

Plans:
- [x] 01-01: Audit and stabilize backend handler contract surface
- [x] 01-02: Normalize frontend API/socket entry points and shared config usage
- [x] 01-03: Refresh architecture, deployment, and planning docs around the split runtime

### Phase 2: Admin Control Plane Expansion
**Goal**: Expand the admin/backend operating surface so live game capability can be controlled without database-level intervention.
**Depends on**: Phase 1
**Requirements**: [ADMIN-01, ADMIN-02]
**Success Criteria** (what must be TRUE):
  1. Admin can manage template/config switches that gate live game capability.
  2. Admin can safely adjust runtime/player settings needed by expansion work.
  3. Backend/admin changes are exposed through explicit handlers rather than ad hoc data edits.
**Plans**: 3 plans

Plans:
- [x] 02-01: Extend admin API surfaces for live capability/config management
- [x] 02-02: Upgrade admin console workflows for expansion-oriented operations
- [x] 02-03: Add guardrails and audit coverage for backend/admin changes

### Phase 3: Hub & Room Expansion Framework
**Goal**: Give the hub and room lifecycle enough structure to support more games, variants, and option surface without fracturing UX.
**Depends on**: Phase 1, Phase 2
**Requirements**: [HUB-01, ROOM-01]
**Success Criteria** (what must be TRUE):
  1. The unified hub can surface additional games or variants through structured metadata.
  2. Room creation and room-number join remain consistent across supported game families.
  3. Expansion-related room capability data can flow cleanly between backend, admin, and frontend.
**Plans**: 3 plans

Plans:
- [ ] 03-01: Introduce structured capability metadata for hub and room discovery
- [ ] 03-02: Normalize room creation/join flows across game families
- [ ] 03-03: Expose expansion-related capability state to frontend and admin surfaces

### Phase 4: Card & Party Gameplay Expansion
**Goal**: Extend live rules, roles, templates, and interactions for Dou Dizhu, Werewolf, and Avalon without breaking shipped match flow.
**Depends on**: Phase 3
**Requirements**: [CARD-01, PARTY-01]
**Success Criteria** (what must be TRUE):
  1. Dou Dizhu can ship additional rules/templates/interactions through the shared room framework.
  2. Werewolf and Avalon can ship richer roles, phases, or room options through the existing live party-room model.
  3. Existing live card/party flows remain playable after expansion changes.
**Plans**: 3 plans

Plans:
- [ ] 04-01: Extend Dou Dizhu templates, rules, and interaction surface
- [ ] 04-02: Extend Werewolf/Avalon role and phase capability
- [ ] 04-03: Validate stability of card and party game regressions after expansion

### Phase 5: Board Gameplay Expansion
**Goal**: Extend Gomoku and Chinese Checkers options/interactions without regressing real-time board play.
**Depends on**: Phase 3
**Requirements**: [BOARD-01]
**Success Criteria** (what must be TRUE):
  1. Gomoku and Chinese Checkers can expose richer room options or interactions through the same board-room model.
  2. Real-time board synchronization remains stable while new capability is added.
  3. The board-family expansion approach matches the shared hub/room framework introduced earlier.
**Plans**: 2 plans

Plans:
- [ ] 05-01: Extend board-game room/model capability for new options and interactions
- [ ] 05-02: Validate board gameplay sync and UX after expansion changes

### Phase 6: Verification & Release Hardening
**Goal**: Build enough safety around the expanded platform that future feature releases are verifiable instead of guess-based.
**Depends on**: Phase 4, Phase 5
**Requirements**: [QUAL-01, QUAL-02]
**Success Criteria** (what must be TRUE):
  1. Critical hub, admin, room, and gameplay flows have automated validation coverage.
  2. Release checks clearly cover the areas most likely to regress during game/backend expansion.
  3. Planning, architecture, and deployment docs are current enough to support the next planning cycle.
**Plans**: 3 plans

Plans:
- [ ] 06-01: Expand automated logic and smoke coverage for critical flows
- [ ] 06-02: Add release validation and regression-check routines
- [ ] 06-03: Refresh operational and planning docs after the hardening pass

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Backend Contract Foundation | 3/3 | Complete | 2026-04-22 |
| 2. Admin Control Plane Expansion | 3/3 | Complete | 2026-04-22 |
| 3. Hub & Room Expansion Framework | 0/3 | Not started | - |
| 4. Card & Party Gameplay Expansion | 0/3 | Not started | - |
| 5. Board Gameplay Expansion | 0/2 | Not started | - |
| 6. Verification & Release Hardening | 0/3 | Not started | - |
