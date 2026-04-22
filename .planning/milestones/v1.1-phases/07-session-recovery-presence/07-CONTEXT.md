# Phase 7: Session Recovery & Presence - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Source:** Direct `$gsd-plan-phase 7` invocation with inline assumptions from the current roadmap, requirements, and shipped codebase

<domain>
## Phase Boundary

Make refresh and reconnect behavior explicit across the shipped room families without changing the product's current entry model or promoting the milestone into multi-node recovery. Phase 7 should tighten the existing room-entry, session, socket, and room-serialization contracts so a seated player can recover an eligible active room and hosts can distinguish connected, reconnecting, and disconnected occupants from the same shared payloads.

</domain>

<decisions>
## Implementation Decisions

### Recovery Scope
- **D-01:** Reuse the shipped `ddz_token` session model plus `/entry/{gameKey}/{roomNo}` flow instead of adding a second recovery-only authentication path.
- **D-02:** Treat recovery as an in-memory continuity feature for rooms that still exist on the current backend node. Cross-restart room resurrection stays out of scope for Phase 7 and belongs to Phase 9.
- **D-03:** Keep Dou Dizhu login-only, but allow logged-in Dou Dizhu players to recover their existing seat after refresh/reconnect the same way other authenticated players do.
- **D-04:** Preserve the current guest model: only scoped guest sessions that already belong to the same room/game may recover, and only on the eligible party/board invite flows shipped in v1.0.

### Presence Model
- **D-05:** Standardize three explicit human-seat presence states across room payloads: `connected`, `reconnecting`, and `disconnected`.
- **D-06:** `reconnecting` is a bounded grace state for players whose seat still exists and whose session is still eligible to resume; it is not a promise of infinite retention.
- **D-07:** Bots remain effectively always connected for presence purposes and must not enter the recovery state machine.

### UI and Product Constraints
- **D-08:** Preserve the current room-page layouts and entry flow. Phase 7 UI work is limited to additive presence badges, reconnect notices, and recovery-safe redirects inside the existing shells.
- **D-09:** Hosts should see occupant presence from the same room payload already used by the room pages; do not create a separate admin-only presence truth for this phase.
- **D-10:** Recovery should not force players through an extra lobby step if a valid session already maps to a live room and seat.

### the agent's Discretion
- Exact reconnect grace-window duration, as long as it is shared, testable, and does not conflict with later stale-room expiry work.
- Exact badge copy or icon treatment for the three presence states, as long as the semantics stay obvious and the existing room layouts remain intact.
- Whether recovery helpers live in `lib/client/room-entry.js` or a nearby shared client helper, as long as pages do not duplicate the logic.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase and milestone contract
- `.planning/PROJECT.md` — Current milestone goal and brownfield compatibility baseline.
- `.planning/ROADMAP.md` — Phase 7 goal, success criteria, and sequencing against Phase 8-10.
- `.planning/REQUIREMENTS.md` — `ROOM-01`, `ROOM-02`, and `ROOM-03` are the locked requirement IDs for this phase.
- `.planning/STATE.md` — Current milestone status and decisions carried into planning.

### Existing room-entry and guest-session baseline
- `.planning/milestones/v1.0-phases/03-hub-room-expansion-framework/03-02-SUMMARY.md` — Shared room directory, resolve/shareable/guest/guest-sync APIs, and guest scope model introduced in v1.0.
- `.planning/milestones/v1.0-phases/03-hub-room-expansion-framework/03-03-SUMMARY.md` — `/entry/{gameKey}/{roomNo}` flow, login `returnTo`, and guest claim UX already shipped.
- `lib/auth.js` — Real-user and scoped guest token/session model.
- `lib/rooms/directory.js` — Shared live-room directory and resolver used by invite/entry flows.
- `lib/socket-server.js` — Socket auth boundary plus guest scope enforcement per room family.
- `lib/shared/network-contract.js` — Existing API and socket contract inventory.
- `backend/handlers/me.js` — Current session payload returned to the browser.
- `backend/handlers/rooms/[roomNo]/index.js` — Card-room detail payload.
- `backend/handlers/party/rooms/[roomNo]/index.js` — Party-room detail payload.
- `backend/handlers/board/rooms/[roomNo]/index.js` — Board-room detail payload.

### Existing room runtime and UI patterns
- `lib/game/room-manager.js` — Card-room seat, socket, trustee, and result-lifecycle behavior.
- `lib/party/manager.js` — Party-room seat, voice, and feed serialization behavior.
- `lib/board/manager.js` — Board-room seat and turn serialization behavior.
- `pages/entry/[gameKey]/[roomNo].js` — Current invite/identity intercept and auto-enter logic.
- `pages/room/[roomNo].js` — Dou Dizhu room page.
- `pages/party/[roomNo].js` — Werewolf/Avalon room page.
- `pages/undercover/[roomNo].js` — Undercover room page with separate UI shell.
- `pages/board/[roomNo].js` — Gomoku/Chinese Checkers/Reversi room page.
- `test-logic/hub-room-entry.test.js` — Existing room-entry, guest, and socket-scope contract coverage.
- `tests/room-ui.spec.js` — Current Dou Dizhu smoke path.
- `tests/arcade-party.spec.js` — Current party smoke path.
- `tests/board-games.spec.js` — Current board smoke path.
- `tests/undercover.spec.js` — Current Undercover smoke path.
- `tests/reversi.spec.js` — Current Reversi smoke path.

</canonical_refs>

<specifics>
## Specific Ideas

- Recovery should remain additive to the shipped room-entry model: the browser should use existing session cookies and current room detail endpoints before trying any explicit rejoin action.
- Presence should become an explicit contract field rather than something inferred from `connected` alone.
- Room pages should show enough presence detail for hosts to avoid kicking someone who is merely reconnecting.
- Undercover uses its own page shell, so Phase 7 should treat it as a first-class consumer instead of assuming `pages/party/[roomNo].js` covers every party title.

</specifics>

<deferred>
## Deferred Ideas

- Cross-node room recovery and durable room snapshots across backend restarts.
- Admin live-ops room directory and intervention tools; those belong to Phase 8.
- Long-tail stale-room cleanup and abandonment policy beyond the reconnect grace window; that belongs to Phase 9.

</deferred>

---

*Phase: 07-session-recovery-presence*
*Context gathered: 2026-04-22*
