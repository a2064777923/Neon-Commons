# Phase 3: Hub & Room Expansion Framework - Research

**Researched:** 2026-04-22
**Domain:** Family-based arcade discovery, cross-game room entry, invite deep links, and capability-aware frontend/backend contracts
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md and UI-SPEC.md)

- Rebuild the homepage around game families rather than a flat launcher (`D-01`).
- Support current shipped games plus future single-player, multiplayer, and light 3D titles (`D-02`, `D-04`).
- Keep future titles visible as either playable or greyed `即將推出` (`D-03`, `D-14`, `D-16`).
- Keep dedicated per-game create-room pages and local room-number quick join (`D-06`, `D-08`).
- Add a universal homepage entry surface for room number, invite links, and room sharing (`D-07`, UI-SPEC `Arcade Command Dock`).
- Share links must deep-link to the correct room/game family and logged-in users should enter directly (`D-09`, `D-10`).
- Unauthenticated invite visitors need a guest-vs-login intercept, but guest access is only valid for invite/private/non-ranked flows (`D-11`, `D-12`).
- If a game is disabled for new rooms, existing live rooms must still remain joinable by room number or invite (`D-15`).
- Frontend direction is fixed by `03-UI-SPEC.md`: bold arcade hub, compact family bands, `遊戲入口` command dock, distinct `暫停新房` vs `即將推出`, and no bland dashboard UI.

Derived project constraints from `AGENTS.md`, `.planning/PROJECT.md`, and Phase 2:
- Keep the frontend/backend split intact; new endpoints belong under `backend/handlers/**`, not `pages/api`.
- Reuse `lib/shared/network-contract.js` and existing client helpers instead of page-local URLs.
- Treat Phase 2 `lib/admin/control-plane.js` as the capability source of truth for shipped games.
- Preserve room-number entry, live Socket.IO room behavior, and per-family room pages as brownfield compatibility targets.
- Use the smallest relevant verification first, then escalate to wider logic/UI coverage for hub and room-entry behavior.
</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Family discovery metadata and upcoming-title definitions | Shared metadata module | Backend hub payload | Catalog structure should live in code, while the frontend consumes one normalized payload. |
| Shipped-game availability (`playable` / `暫停新房`) | Phase 2 control-plane state | Hub payload synthesizer | Existing capability booleans already define new-room gating; Phase 3 should synthesize UI-facing states from them rather than invent a second source of truth. |
| Universal room-number resolution | Shared room directory/registry | Room managers | Cross-game room entry only works safely if room numbers resolve globally instead of per-manager in isolation. |
| Invite deep-link and guest session boundary | Backend contract layer | Frontend entry page | Invite validation, room eligibility, and guest token/session rules must live server-side; the entry page only orchestrates the user flow. |
| Per-game create-room continuity | Existing lobby pages | Shared entry contract | Family lobbies remain the detailed room-setup surface, but they should consume the new state/share metadata contract. |
| Post-match guest sync ledger | Backend persistence | Result overlays / account handoff UI | The room framework needs a durable way to claim a guest session into a real account after a match ends. |
</architectural_responsibility_map>

<research_summary>
## Summary

The codebase already contains the core ingredients for Phase 3, but they are still family-siloed:

1. **Homepage discovery is frontend-only fan-out today.** `pages/index.js` calls six different room-list endpoints plus `me` and `leaderboard`, then locally merges flat game cards. That is workable for five titles, but it cannot cleanly represent family bands, upcoming titles, or control-plane-driven pause states without pushing business logic into the page.
2. **Current room numbers are only unique inside each manager.** `lib/game/room-manager.js`, `lib/party/manager.js`, and `lib/board/manager.js` each generate their own six-digit numbers. A universal room-number entry flow is therefore unsafe today because cross-family collisions are possible. Since active rooms are memory-resident and cleared on backend restart, Phase 3 can fix this by introducing a shared allocator/registry without a persistent migration burden.
3. **Phase 2 already solved new-room gating for shipped titles.** `lib/admin/control-plane.js` exposes per-game capability booleans and runtime controls, and create handlers already block new rooms while leaving existing rooms alone. That exactly matches the user's `暫停新房` requirement, but the frontend currently does not consume that state.
4. **Invite and guest flow does not exist yet.** Every room detail/join page redirects unauthenticated users to `/login`, and Socket.IO only trusts `ddz_token` payloads representing real logged-in users. There is no return path, no guest session model, and no cross-game resolver endpoint.
5. **Party and board rooms are guest-friendly candidates; Dou Dizhu is not in its current form.** Party/board flows do not persist ranked economy results through `users` references, while Dou Dizhu settlement writes `landlord_user_id` and user deltas into persistent tables. A first-pass guest flow should therefore treat Dou Dizhu as login-only and allow guest entry only for private invite links on party/board families and future non-ranked titles.

**Primary recommendation:** build Phase 3 around three layers:
- a normalized discovery layer (`catalog + capability overlay + /api/hub`)
- a shared room directory and room-entry contract (`resolve + shareable + guest + guest-sync`)
- a frontend rewrite that consumes those contracts instead of hand-merging siloed room data

This decomposition matches the roadmap's three plan slots and keeps the brownfield compatibility boundary intact.
</research_summary>

<current_state_audit>
## Current State Audit

### What already works

- `pages/index.js` already aggregates live rooms across Dou Dizhu, party, and board families.
- `lib/games/catalog.js` already stores game metadata and family defaults for shipped party/board titles.
- `lib/admin/control-plane.js` already defines the shipped-game capability source of truth and the exact `new-rooms-only` semantics chosen in Phase 2.
- Room detail endpoints already serialize `gameKey`, `roomNo`, visibility/config, and viewer-specific room state, which is enough to build a universal entry resolver.
- `pages/lobby.js` and `pages/games/[gameKey].js` already provide dedicated create-room and local quick-join flows that can be preserved instead of redesigned.

### Gaps that block Phase 3

- There is no shared family catalog for upcoming titles such as `UNO 類`, `誰是臥底`, `你畫我猜`, `黑白棋`, `飛行棋`, `推箱子`, `保齡球`, and `迷你賽車/碰碰車`.
- There is no backend hub endpoint; the homepage owns aggregation logic and cannot reliably overlay control-plane state or future-title metadata.
- Cross-family room-number lookup is unsafe because room numbers are generated independently by three room managers.
- There is no backend-owned invite/deep-link contract, no return-to-login flow, and no guest session/session-claim model.
- Current join handlers require real user auth for every room family, so invite links cannot admit unauthenticated visitors.
- The homepage and family lobbies do not expose `暫停新房` as "still joinable by room number/invite" or `即將推出` as an explicit teaser state.

### Critical implementation landmines

- `lib/socket-server.js` validates a single `ddz_token` cookie and forwards `socket.user.id` directly into room managers. Any guest flow has to fit that handshake or replace it safely.
- Dou Dizhu result settlement writes persistent `users`-linked data in `lib/game/room-manager.js`, so guest sessions cannot be treated as ordinary persistent users there without extra accounting work.
- `pages/login.js` always routes to `/` after success, so invite handoff will feel broken unless `returnTo` is supported.
- `pages/index.js` and room-page smoke tests currently assume specific copy and CTAs; Phase 3 planning must update both implementation and automated coverage together.
</current_state_audit>

<recommended_direction>
## Recommended Direction

### 1. Create a normalized discovery layer for shipped and upcoming titles

Expand `lib/games/catalog.js` from a shipped-game metadata map into a structured discovery source that includes:
- family metadata
- per-title discovery attributes (`familyKey`, `roomRoute`, `supportsShareLink`, `guestEligibility`, `launchState`)
- the exact future-title pool from `D-04`

Keep shipped-game `playable` vs `暫停新房` state derived from `lib/admin/control-plane.js`, while future titles remain catalog-defined `coming-soon` entries. This preserves Phase 2 as the capability source of truth instead of creating a parallel state system.

### 2. Add a unified `/api/hub` payload instead of continuing homepage fan-out

Create a public backend hub endpoint that returns:
- family sections
- per-title discovery cards with synthesized states
- live-room feed
- command-dock metadata (`room number`, `invite`, `shareable rooms`)

This moves state synthesis to the backend where control-plane data, catalog data, and live-room summaries can be merged consistently.

### 3. Introduce a shared in-memory room directory and global room-number allocator

Phase 3 needs universal room-number entry. That requires:
- one allocator for all new rooms across card/party/board managers
- a shared room directory that records `roomNo`, `gameKey`, `familyKey`, `visibility`, `ownerId`, and destination path
- a resolver API that can answer "what room is this number/link pointing to?" without the homepage knowing every family-specific handler

Because active rooms are already memory-resident and wiped on backend restart, switching to a shared allocator is low-risk and does not require backfilling persistent data.

### 4. Implement invite deep links as frontend entry routes plus backend validation

Use a simple, backend-validated deep-link format such as `/entry/{gameKey}/{roomNo}`:
- room pages and shareable-room APIs can generate this URL deterministically
- logged-in users can resolve and redirect immediately
- unauthenticated users can land on one entry page instead of being dumped at `/login`

The backend should still validate that `{gameKey, roomNo}` points to a live room and return the correct family destination.

### 5. Support guest entry only for eligible private invite flows

For Phase 3:
- allow guest entry only when the room is private/invite-based and the game family is guest-eligible
- treat Dou Dizhu as login-only in the first pass because its current room flow is leaderboard/economy connected
- mint room-scoped guest sessions/tokens for party and board invite entry
- add a lightweight `guest_match_links` persistence path so a finished guest match can later be claimed into a real account history ledger

This satisfies the user decision without forcing guest participation into every existing public/ranked flow.

### 6. Preserve family-specific create-room pages and retrofit them with state/share awareness

Do not merge room creation. Instead:
- keep `pages/lobby.js` and `pages/games/[gameKey].js`
- add pause banners when new rooms are blocked
- keep local quick-join controls
- surface `copy invite` / `return to game families` actions using the same room-entry contract as the homepage

### 7. Update login and result overlays so the invite/guest lifecycle closes cleanly

The UX contract requires:
- `returnTo` support in `pages/login.js`
- a lightweight invite intercept page
- a post-match guest sync prompt on party/board result overlays

These are not optional polish items; they are the connective tissue that makes invite links and guest entry actually usable.
</recommended_direction>

## Validation Architecture

### Fast feedback

- `node --test test-logic/hub-room-entry.test.js`
- `npm run check`

### Wave-level validation

- `node --test test-logic/admin-control-plane.test.js test-logic/hub-room-entry.test.js`
- `npm run check`

### High-risk smoke validation

- `npx playwright test tests/hub-entry.spec.js --workers=1`
- `npx playwright test tests/arcade-party.spec.js tests/board-games.spec.js --workers=1`

### Expected artifacts

- a shared hub payload endpoint and discovery metadata helpers
- a shared room directory/global room-number allocator
- room-entry resolve/shareable/guest/sync backend handlers
- a new entry page and updated homepage/family lobbies consuming the shared contracts
- `test-logic/hub-room-entry.test.js` for hub metadata, room resolution, and guest gating
- `tests/hub-entry.spec.js` for homepage command dock and invite-entry smoke coverage

## Open Questions

1. **Should Dou Dizhu support guest invite entry in Phase 3?**
   - What we know: current Dou Dizhu settlement writes persistent user-linked results and leaderboard-connected deltas.
   - Recommendation: no. Mark Dou Dizhu invite links as login-only for this phase; allow guest entry only on private party/board rooms and future non-ranked titles.

2. **Should share links use opaque signed invite codes or readable room routes?**
   - What we know: existing room-number flow already treats `roomNo` as the possession key, and the UI-SPEC leaves URL shape to planner discretion.
   - Recommendation: use readable deep links like `/entry/{gameKey}/{roomNo}` and validate them server-side. This keeps implementation smaller and aligns with the current brownfield model.

3. **Does the homepage keep calling per-family room-list endpoints directly?**
   - What we know: current fan-out works but embeds discovery synthesis in `pages/index.js`.
   - Recommendation: no. Replace it with a single `/api/hub` payload so control-plane state, upcoming titles, and live-room aggregation are unified.

<sources>
## Sources

### Primary (HIGH confidence)
- `pages/index.js` — current homepage aggregation and flat card structure
- `pages/lobby.js` — Dou Dizhu create/join baseline
- `pages/games/[gameKey].js` — party/board family lobby baseline
- `pages/room/[roomNo].js` — card-room auth and room-entry behavior
- `pages/party/[roomNo].js` — party-room auth and result overlay behavior
- `pages/board/[roomNo].js` — board-room auth and result overlay behavior
- `lib/games/catalog.js` — existing shipped-game metadata
- `lib/admin/control-plane.js` — capability state and new-room-only enforcement
- `lib/shared/network-contract.js` — current route contract inventory
- `backend/handlers/rooms/index.js` — card-room create/list enforcement point
- `backend/handlers/party/rooms/index.js` — party-room create/list enforcement point
- `backend/handlers/board/rooms/index.js` — board-room create/list enforcement point
- `backend/handlers/admin/capabilities/index.js` — capability GET/PATCH contract
- `backend/handlers/admin/logs/index.js` — admin trace/read surface
- `lib/socket-server.js` — Socket.IO authentication boundary
- `lib/auth.js` — cookie/JWT session model
- `lib/game/room-manager.js` — local room-number generation and Dou Dizhu settlement coupling
- `lib/party/manager.js` — party-room summary serialization
- `lib/board/manager.js` — board-room summary serialization
- `components/MatchResultOverlay.js` — reusable result modal contract
- `tests/arcade-party.spec.js` — current homepage + party smoke expectations
- `tests/board-games.spec.js` — board room smoke expectations
- `tests/room-ui.spec.js` — card-room smoke expectations

### Secondary (MEDIUM confidence)
- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/phases/02-admin-control-plane-expansion/02-CONTEXT.md`
- `.planning/phases/03-hub-room-expansion-framework/03-CONTEXT.md`
- `.planning/phases/03-hub-room-expansion-framework/03-UI-SPEC.md`
- `AGENTS.md`
</sources>
