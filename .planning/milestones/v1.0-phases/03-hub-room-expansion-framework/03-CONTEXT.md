# Phase 3: Hub & Room Expansion Framework - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Prepare the unified hub and room-entry lifecycle so the product can grow from the current five shipped games into a larger family-based arcade. This phase should standardize discovery, room-number/invite entry, capability-aware visibility, and future-game metadata while preserving each game's dedicated create-room flow. It is not a commitment to fully ship every new gameplay candidate inside this phase.

</domain>

<decisions>
## Implementation Decisions

### Hub Information Architecture
- **D-01:** Rebuild the main hub around game families instead of a flat per-title list.
- **D-02:** The hub framework must be able to host current games plus future single-player, online multiplayer, and light 3D titles, not just the current card/party/board split.
- **D-03:** Future titles can appear in the hub in two states: playable now if implementation is finished, or greyed `即將推出` if the title is planned but not ready yet.

### Future Game Pipeline
- **D-04:** The first priority pool for new titles is `UNO 類`, `誰是臥底`, `你畫我猜`, `黑白棋`, `飛行棋`, `推箱子`, `保齡球`, and `迷你賽車/碰碰車`.
- **D-05:** The framework should make it easy to add more fun games quickly, but the planner should still sequence actual gameplay delivery by feasibility after the hub/room framework is in place.

### Room Creation and Entry Model
- **D-06:** Keep dedicated per-game create-room pages and forms; do not replace them with one giant cross-game create-room form.
- **D-07:** Add a cross-game universal entry point on the homepage/hub so players can enter by room number or share link without first navigating to a specific game page.
- **D-08:** Per-game pages should still keep their own local room-number fast-entry controls in addition to the new cross-game hub entry point.

### Invite Links and Identity Flow
- **D-09:** Share links should deep-link directly to the target room and resolve the correct game family automatically.
- **D-10:** Players who already have a valid session should enter directly from an invite link without an extra lobby step.
- **D-11:** Unauthenticated invite-link visitors should be offered a choice between guest entry and account login before entering the room.
- **D-12:** Guest entry is allowed only for invite/private/non-ranked room flows. Guest players should not enter public discovery, ranked, or leaderboard-connected flows through this first pass.
- **D-13:** After a guest completes a match, offer account login/linking so that session's match information can be synced into an account history path.

### Capability Visibility and Access Rules
- **D-14:** Disabled or unavailable games should stay visible in the hub as greyed cards instead of disappearing completely.
- **D-15:** If a game is disabled only for new rooms, existing live rooms must still remain joinable by room number or invite link.
- **D-16:** Greyed cards for `暫停新房` and `即將推出` should communicate different meanings: one is temporarily not opening new rooms, the other is a planned title that is not playable yet.

### the agent's Discretion
- Exact family names, ordering, and whether some future titles sit under new families or under existing ones.
- Exact placement and visual treatment of the cross-game room-number / invite-link entry module on the homepage.
- Exact invite URL shape, guest CTA copy, and the microcopy used to distinguish `暫停新房` from `即將推出`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase and requirement boundary
- `.planning/PROJECT.md` — Product baseline, brownfield constraints, and the "expand current game families/backend capability" milestone direction.
- `.planning/REQUIREMENTS.md` — `HUB-01` and `ROOM-01` define the requirement contract for this phase.
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, and sequencing against later gameplay-expansion phases.
- `.planning/STATE.md` — Current milestone status after Phase 2 completion.
- `.planning/phases/02-admin-control-plane-expansion/02-CONTEXT.md` — Locked decisions about game-family grouping, capability state, and new-room-only behavior that Phase 3 must carry forward.

### Architecture and runtime contract
- `.planning/codebase/ARCHITECTURE.md` — Split frontend/backend architecture and active-room constraints.
- `.planning/codebase/CONVENTIONS.md` — Existing coding/runtime patterns to preserve.
- `.planning/codebase/STACK.md` — Runtime, test, and deployment expectations for hub/room work.
- `.planning/codebase/STRUCTURE.md` — File layout for hub pages, room pages, backend handlers, and tests.
- `docs/architecture/backend-contract.md` — Canonical split-runtime contract for frontend/backend route ownership and `/api` + `/socket.io` boundaries.

### Existing hub, metadata, and capability surfaces
- `pages/index.js` — Current unified hub/homepage and room-feed aggregation baseline.
- `pages/lobby.js` — Current Dou Dizhu-specific room creation and room-number join flow.
- `pages/games/[gameKey].js` — Current party/board family room creation and join baseline.
- `pages/room/[roomNo].js` — Card-room destination for deep-linked room entry.
- `pages/party/[roomNo].js` — Party-room destination for deep-linked room entry.
- `pages/board/[roomNo].js` — Board-room destination for deep-linked room entry.
- `lib/games/catalog.js` — Current game metadata model and default per-game configuration helpers.
- `lib/shared/network-contract.js` — Shared route builders for room creation, detail, and join flows.
- `lib/admin/control-plane.js` — Current source of truth for capability state and new-room gating.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pages/index.js`: Already aggregates live rooms across all shipped families and has a central stage area that can evolve into the cross-game entry surface.
- `pages/lobby.js`: Already provides a polished dedicated create-room and room-number join workflow for Dou Dizhu.
- `pages/games/[gameKey].js`: Already acts as a reusable family-page baseline for party and board game create/join flows.
- `lib/games/catalog.js`: Already defines title, route, players, strapline, and feature metadata per game; this is the natural place to expand family/upcoming/share-entry metadata.
- `lib/admin/control-plane.js`: Already defines whether a game is enabled for new rooms and should drive live/greyed frontend state.
- `lib/shared/network-contract.js`: Already centralizes route builders for room list/detail/join flows and can host any new invite-entry contract additions.

### Established Patterns
- The repo already prefers one dedicated create-room experience per game/family instead of a universal cross-game backend form; Phase 3 should preserve that product pattern.
- All shipped room families already converge on 6-digit room numbers and dedicated room pages after join.
- Capability state is explicit and new-room-only; frontend discovery should reflect that instead of hiding disabled titles.
- Frontend/backend contract changes must stay inside shared client/backend paths, not page-local ad hoc URLs.

### Integration Points
- Homepage / hub UI is the main place to introduce cross-game family sections and universal entry controls.
- Per-game lobby pages remain the place for detailed room setup and family-specific create-room controls.
- Room detail pages (`/room`, `/party`, `/board`) are the eventual deep-link destinations for invite-link entry.
- Admin capability state can directly influence hub card states such as live, `暫停新房`, and `即將推出`.

</code_context>

<specifics>
## Specific Ideas

- The hub should feel like a game-family arcade, not just a flat launcher.
- The homepage should expose a universal cross-game room-number / invite-link entry point.
- Invite links should take players straight to the corresponding room flow, with returning users entering directly.
- Unauthenticated invite-link users should be allowed to choose guest mode or account login.
- Guest mode should be private/invite-oriented only, and a finished guest session should have a clear "link account and sync this match" path.
- Greyed cards should stay visible and communicate whether a title is `暫停新房` or `即將推出`.
- The new-title priority pool is: `UNO 類`, `誰是臥底`, `你畫我猜`, `黑白棋`, `飛行棋`, `推箱子`, `保齡球`, `迷你賽車/碰碰車`.
- The product direction is to get more games in quickly across single-player, multiplayer, and light 3D categories so the arcade feels more fun and alive.

</specifics>

<deferred>
## Deferred Ideas

- Full gameplay implementation of every candidate title is not guaranteed by this framework phase; unfinished titles should surface as `即將推出` and then move into later gameplay phases or backlog execution.
- Public/ranked guest participation remains out of scope for this first guest-entry pass; guest access is restricted to invite/private/non-ranked flows.
- Deep hardening for guest-to-account merge edge cases such as economy reconciliation, abuse controls, and profile conflict resolution can follow after the initial invite/guest sync contract is established.

</deferred>

---

*Phase: 03-hub-room-expansion-framework*
*Context gathered: 2026-04-22*
