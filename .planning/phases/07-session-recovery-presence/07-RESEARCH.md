# Phase 7: Session Recovery & Presence - Research

**Researched:** 2026-04-22
**Domain:** Room-session continuity, reconnect state handling, and host-visible occupant presence across the shipped room families
**Confidence:** HIGH

<user_constraints>
## User Constraints (from ROADMAP.md, REQUIREMENTS.md, STATE.md, and AGENTS.md)

- Preserve the split frontend/backend runtime and keep `/api/*` plus `/socket.io/*` owned by the dedicated backend.
- Do not invent new per-game entry flows; Phase 7 should build on the shared room-entry contract already shipped in v1.0.
- Recover eligible active rooms only within the current single-node runtime. Distributed or cross-restart recovery is deferred to later phases.
- Keep Dou Dizhu login-only while allowing its authenticated players to recover existing seats.
- Guest recovery must stay limited to the already-scoped room/game sessions used by shipped private party/board invite flows.
- Hosts need an explicit three-state presence signal, not just a binary `connected` boolean.
- UI work should preserve the established room layouts and add only targeted recovery/presence affordances.

</user_constraints>

<research_summary>
## Summary

The shipped platform already contains most of the recovery foundation Phase 7 needs:

1. **Seat continuity already exists in memory.** All three room managers keep the seat record after a player joins, and rejoining the same room with the same session ID simply reactivates that seat instead of creating a duplicate.
2. **Refresh partially works today for valid sessions.** Room detail handlers serialize the viewer from the current session, and the room pages already reconnect Socket.IO and re-subscribe on `connect`. For many happy-path refreshes, the player effectively returns to the room already.
3. **Presence is still underspecified.** Managers only expose `connected: boolean`. That is enough for "online/offline" but not enough for host decisions, reconnect grace windows, or deterministic client messaging.
4. **Guest scoping is already strong.** `lib/auth.js`, `backend/handlers/room-entry/guest.js`, and `lib/socket-server.js` already enforce room-scoped guest tokens and reject cross-room socket usage.
5. **The biggest missing layer is a formal recovery contract.** There is no shared payload field that says whether a seat is recoverable, how long reconnect grace lasts, or whether a user is temporarily reconnecting versus fully gone.

**Primary recommendation:** treat Phase 7 as a contract-and-state-machine pass rather than a brand-new feature family.

- Plan 01 should standardize the recovery and presence payload shape across `/api/me`, room detail handlers, and manager serialization.
- Plan 02 should add a bounded reconnect grace state machine in room managers and socket handlers without changing the existing room-entry routes.
- Plan 03 should surface that contract inside the existing room pages and extend the shipped smoke suites to cover refresh/reconnect and host-visible presence states.

</research_summary>

<current_state_audit>
## Current State Audit

### What already works

- `pages/entry/[gameKey]/[roomNo].js` already auto-enters logged-in users and same-room guests instead of making them choose again.
- `backend/handlers/me.js` already returns both `user` and `session`, which lets browsers distinguish real users from scoped guests.
- `lib/game/room-manager.js`, `lib/party/manager.js`, and `lib/board/manager.js` all reuse an existing human seat on `joinRoom` if the same `user.id` returns.
- `registerSocket` in all three managers marks the seat as connected again and emits a fresh room snapshot.
- `lib/socket-server.js` already re-subscribes on reconnect and enforces guest scope against the shared room directory.

### Gaps that still block Phase 7

- No payload exposes `reconnecting` as a first-class state. A disconnect immediately flips to `connected: false`, which is too coarse for host moderation decisions.
- There is no shared recovery metadata such as grace-window expiry, recovery eligibility, or "this viewer is expected to recover" semantics.
- Party, board, Undercover, and card room pages all manage reconnect messaging ad hoc or not at all.
- Existing Playwright smokes cover room creation and gameplay, but not refresh/reconnect continuity or host-visible presence-state transitions.

### Important landmines

- Dou Dizhu currently turns a disconnected in-match seat into trustee mode; Phase 7 must preserve that behavior while still surfacing reconnect state.
- Undercover uses its own page shell instead of re-exporting `pages/party/[roomNo].js`, so a party-family-only plan would miss a shipped route.
- `maybeCloseCompletedRoom()` in all managers can archive completed rooms when no connected human seats remain. Phase 7 should avoid broadening that lifecycle rule into a stale-room policy rewrite; only the reconnect grace window belongs here.
- The room pages already depend heavily on serialized room shape. Any new recovery fields must be additive and backward-compatible.

</current_state_audit>

<recommended_direction>
## Recommended Direction

### 1. Standardize presence and recovery metadata in serialized room payloads

Add explicit shared fields such as:

- `presenceState`
- `recoveryEligible`
- `reconnectGraceEndsAt`
- `recoveryScope` or equivalent viewer/session hint

Keep the legacy `connected` boolean during Phase 7 so brownfield UI and tests can migrate incrementally.

### 2. Reuse the existing session and entry model instead of adding a new recovery route

The current browser contract is already close:

- session cookie
- `/api/me`
- room detail endpoint
- socket `subscribe`
- `/entry/{gameKey}/{roomNo}` for invite identity handling

Phase 7 should make that flow deterministic, not replace it.

### 3. Add a bounded reconnect grace state machine in the room managers

Recommended state transition:

- `connected` while socket IDs exist
- `reconnecting` immediately after the last socket disconnects from a recoverable seat
- `disconnected` only after the grace window expires or the seat becomes non-recoverable

This lets hosts avoid overreacting to transient refreshes while keeping the model compatible with later stale-room cleanup work.

### 4. Keep guest recovery scoped to the same room/game token

The current guest token already carries `gameKey` and `roomNo`, and socket scope checks already use those fields. Phase 7 should build on that by letting room pages trust the existing scoped guest session during recovery, not by widening guest privileges.

### 5. Surface recovery and presence inside existing room shells

Recommended UI changes:

- host-visible presence chips/badges on player lists
- reconnect banner or toast for the current viewer when the socket drops and returns
- refresh-safe rehydration that does not kick a valid seated session back to login or a create-room page

This phase does not need a layout redesign, new dashboard, or new operator console.

</recommended_direction>

## Validation Architecture

### Fast feedback

- `node --test test-logic/hub-room-entry.test.js test-logic/client-network-contract.test.js`

### Wave-level validation

- `node --test test-logic/hub-room-entry.test.js test-logic/client-network-contract.test.js test-logic/session-recovery.test.js`
- `npm run check`

### High-risk smoke validation

- `FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/room-ui.spec.js tests/arcade-party.spec.js tests/board-games.spec.js tests/undercover.spec.js tests/reversi.spec.js --workers=1`

### Expected artifacts

- additive recovery/presence fields in room payloads and `/api/me`
- reconnect grace handling inside card, party, and board managers
- room-page recovery helpers plus host-visible presence UI
- node and Playwright regression coverage for refresh/reconnect continuity

## Open Questions

1. **Does Phase 7 need a new recovery-specific backend endpoint?**
   - Recommendation: no. Reuse `/api/me`, existing room detail handlers, and current join/subscribe flows.

2. **Should a transient disconnect immediately archive a completed room with a result screen open?**
   - Recommendation: no. Respect the reconnect grace window for this phase, but leave longer-term stale-room policy to Phase 9.

3. **Should hosts see raw socket status or a product-level presence state?**
   - Recommendation: product-level presence state. Keep socket details internal and expose only `connected`, `reconnecting`, `disconnected`.

<sources>
## Sources

### Primary (HIGH confidence)
- `lib/auth.js`
- `lib/socket-server.js`
- `lib/rooms/directory.js`
- `lib/game/room-manager.js`
- `lib/party/manager.js`
- `lib/board/manager.js`
- `backend/handlers/me.js`
- `backend/handlers/rooms/[roomNo]/index.js`
- `backend/handlers/party/rooms/[roomNo]/index.js`
- `backend/handlers/board/rooms/[roomNo]/index.js`
- `pages/entry/[gameKey]/[roomNo].js`
- `pages/room/[roomNo].js`
- `pages/party/[roomNo].js`
- `pages/undercover/[roomNo].js`
- `pages/board/[roomNo].js`
- `test-logic/hub-room-entry.test.js`
- `test-logic/client-network-contract.test.js`
- `tests/room-ui.spec.js`
- `tests/arcade-party.spec.js`
- `tests/board-games.spec.js`
- `tests/undercover.spec.js`
- `tests/reversi.spec.js`

### Secondary (MEDIUM confidence)
- `.planning/PROJECT.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/milestones/v1.0-phases/03-hub-room-expansion-framework/03-02-SUMMARY.md`
- `.planning/milestones/v1.0-phases/03-hub-room-expansion-framework/03-03-SUMMARY.md`
- `AGENTS.md`

</sources>
