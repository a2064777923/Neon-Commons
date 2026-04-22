# Phase 9: Single-Node Recovery Guardrails - Research

**Researched:** 2026-04-22
**Domain:** Single-node room-directory persistence, stale-room expiry, and brownfield compatibility after backend restarts
**Confidence:** HIGH

<user_constraints>
## User Constraints (from ROADMAP.md, REQUIREMENTS.md, STATE.md, PROJECT.md, and AGENTS.md)

- Preserve the split frontend/backend runtime and keep `/api/*` plus `/socket.io/*` owned by the dedicated backend.
- Stay inside the current single-node model. Phase 9 may persist metadata, but it must not imply multi-node room recovery or distributed coordination.
- Protect the shipped hub, room-number join flow, invite/guest entry flow, and Socket.IO room behavior as the compatibility baseline.
- Keep the brownfield release contract around `npm run deploy:3100` and `npm run verify:release`; ephemeral app-container storage is not a safe source of truth for restart recovery.
- Reuse the existing shared room directory where possible instead of introducing per-family discovery registries.
- Respect Phase 7 reconnect grace behavior; stale cleanup must not erase seats before the bounded reconnect window expires.
- Prefer incremental additive contracts. Snapshot and expiry metadata should extend current payloads and handlers rather than force a new frontend/backend architecture.

</user_constraints>

<research_summary>
## Summary

The current platform has a strong shared room-directory foundation, but it is still strictly in-memory:

1. **The room directory is already the right aggregation point for restart metadata.** `lib/rooms/directory.js` is the single cross-family source for room-number resolution, shareable-room discovery, and guest-entry scope checks.
2. **Current restart behavior loses all directory state.** `backend/server.js` initializes Postgres and starts Socket.IO, but it never snapshots or reloads directory entries. A backend restart clears `global.neonCommonsRoomDirectory` immediately.
3. **Hub discovery is not yet backed by the shared directory.** `backend/handlers/hub.js` still asks each room manager for public rooms, so directory-only recovery cannot rebuild hub-facing live discovery until Phase 9 aligns that handler.
4. **Snapshot-only entries need explicit compatibility semantics.** `room-entry/resolve`, `room-entry/shareable`, `room-entry/guest`, and the direct room detail handlers currently assume a resolved directory entry or room number points at a live manager room. After restart, that assumption becomes false unless the handlers distinguish `live` from `snapshot-only`.
5. **PostgreSQL is the pragmatic snapshot store.** The repo already initializes and seeds database tables in `lib/db.js`, while the canonical deployment recreates the application container. Writing snapshot files inside the app container would not survive the deployed-stack restart path reliably.

**Primary recommendation:** treat Phase 9 as a guardrail phase around the shared room directory, not as full live-match resurrection.

- Plan 01 should add a PostgreSQL-backed room-directory snapshot store and bootstrap it at backend startup.
- Plan 02 should add predictable stale-room and abandoned-snapshot cleanup rules that respect Phase 7 reconnect grace.
- Plan 03 should align hub, room-entry, guest-claim, and detail-handler behavior around restored snapshot entries so the system does not advertise dead rooms as live playable matches.

</research_summary>

<current_state_audit>
## Current State Audit

### What already works

- `registerRoomEntry`, `updateRoomEntry`, and `unregisterRoomEntry` already centralize cross-family directory writes in `lib/rooms/directory.js`.
- All three room managers call `syncRoomDirectory(room)` from create/join/update/emit paths, so `updatedAt` already approximates live room activity.
- `room-entry/resolve`, `room-entry/shareable`, and `room-entry/guest` already rely on the shared directory instead of per-family routing guesses.
- The room managers already have one bounded reconnect-grace state machine from Phase 7, including `reconnectGraceEndsAt` and "close completed room only after reconnect grace expires".
- The database bootstrap path in `lib/db.js` is a natural place to add one more runtime-support table without inventing a migration framework first.

### Gaps that still block Phase 9

- The directory store is only a process-global `Map`. A restart drops all room-number resolution and share-link state.
- Hub discovery bypasses the directory entirely, so directory persistence alone will not repopulate the home-page live feed or per-game discovery counts.
- Snapshot-only entries would currently create false positives: `resolveRoomEntry()` can say a room exists while the card/party/board detail handlers still 404 because their managers have empty `rooms` maps after restart.
- There is no general stale-room cleanup for waiting or in-progress rooms after all humans leave. Existing `maybeCloseCompletedRoom()` helpers only clean up finished rooms with `lastResult`.
- Snapshot rows would linger forever unless expiry is planned together with persistence.

### Important landmines

- **Do not fake live-match resume.** Persisting room-directory metadata is not the same as rebuilding full round/match state, and the phase goal explicitly stays single-node.
- **Do not use container-local files as the only snapshot store.** The canonical Docker redeploy recreates the app container.
- **Do not let guest-entry handlers issue new guest sessions into snapshot-only rooms.** That would widen access into rooms the managers cannot actually serve.
- **Do not let hub cards or deep links silently redirect into dead room detail routes.** Restored discovery must be honest about availability.
- **Do not bypass the existing reconnect grace window.** Expiry rules must start after reconnect grace and no-human detection, not replace them.

</current_state_audit>

<recommended_direction>
## Recommended Direction

### 1. Persist only directory-grade metadata, not full game state

Add one snapshot table such as `room_directory_snapshots` with:

- stable identifiers: `room_no`, `family_key`, `game_key`
- discovery copy: `title`, `strapline`, `detail_route`, `join_route`
- access/ownership fields: `visibility`, `owner_id`, `guest_allowed`, `supports_share_link`
- membership/discovery fields: `member_ids`, `room_state`, `last_active_at`
- recovery bookkeeping: `source`, `restored_at`, `updated_at`

This is enough to repopulate discovery and routing decisions without pretending a live match was reconstructed.

### 2. Rehydrate the shared directory at backend startup

After `initializeDatabase()` completes, bootstrap the in-memory directory cache from snapshot rows before the server starts listening. Restored entries should carry an internal marker such as `source: "snapshot"` so later handlers can distinguish them from manager-backed live entries.

### 3. Treat stale cleanup as a shared lifecycle rule

Phase 9 should define one backend-owned expiry model:

- reconnect grace first (`reconnecting` from Phase 7)
- abandonment window second (zero connected/reconnecting human seats)
- archive/unregister third (remove both in-memory and persisted directory presence)

Use the existing `roomExpiryMinutes` system-config value as the policy source, with `DEFAULT_SYSTEM_CONFIG.roomExpiryMinutes` as fallback.

### 4. Align consumer behavior around `live` vs `snapshot-only`

Recommended compatibility contract:

- hub discovery may surface restored entries, but must label them as not currently live
- room-entry resolution should expose additive availability metadata instead of pretending every entry is joinable
- guest entry should reject snapshot-only rooms with a clear error
- direct room detail handlers should return a recovery-aware non-200 response when only snapshot metadata exists

This lets discovery survive restart while still failing closed for live gameplay entry.

### 5. Keep Phase 9 reusable for Phase 8 and Phase 10

The shared directory snapshot layer should become the backend source that later live-ops/admin surfaces can inspect, and Phase 10 can extend canonical release verification around restart and stale cleanup without reworking the data model again.

</recommended_direction>

## Validation Architecture

### Fast feedback

- `node --test test-logic/room-directory-persistence.test.js`

### Wave-level validation

- `node --test test-logic/room-directory-persistence.test.js test-logic/room-expiry.test.js test-logic/hub-room-entry.test.js test-logic/session-recovery.test.js`
- `npm run check`

### High-risk smoke validation

- Manual deployed-stack smoke until Phase 10 formalizes it:
  - create at least one room
  - restart the backend/app stack on `3100/3101`
  - verify the hub / room-entry / direct-detail paths show honest recovery or unavailability semantics
  - verify stale rooms disappear after the configured expiry window

### Expected artifacts

- PostgreSQL-backed room-directory snapshot table and bootstrap helpers
- startup rehydration for the shared directory
- stale-room / abandoned-snapshot cleanup rules aligned across card, party, and board managers
- additive availability semantics for hub, room-entry, guest, and room-detail handlers
- node coverage for persistence, expiry, and compatibility edge cases

## Open Questions

1. **Should snapshot-only rooms remain clickable from public discovery?**
   - Recommendation: only if handlers and entry pages expose explicit `availability` semantics. Otherwise, render them as non-live discovery results or keep them out of clickable feeds.

2. **Should Phase 9 read expiry policy from `system_configs` or hardcode it?**
   - Recommendation: use `roomExpiryMinutes` from `system_configs` with the existing default fallback so operators do not end up with two conflicting sources of truth.

3. **Should Phase 9 rebuild actual room-manager state after restart?**
   - Recommendation: no. Persist directory-grade metadata only, and make unavailability honest instead of simulating live match recovery.

<sources>
## Sources

### Primary (HIGH confidence)
- `lib/rooms/directory.js`
- `lib/db.js`
- `lib/defaults.js`
- `backend/server.js`
- `backend/handlers/hub.js`
- `backend/handlers/room-entry/resolve.js`
- `backend/handlers/room-entry/shareable.js`
- `backend/handlers/room-entry/guest.js`
- `backend/handlers/rooms/[roomNo]/index.js`
- `backend/handlers/party/rooms/[roomNo]/index.js`
- `backend/handlers/board/rooms/[roomNo]/index.js`
- `lib/socket-server.js`
- `lib/game/room-manager.js`
- `lib/party/manager.js`
- `lib/board/manager.js`
- `test-logic/hub-room-entry.test.js`
- `test-logic/session-recovery.test.js`
- `docs/architecture/backend-contract.md`

### Secondary (MEDIUM confidence)
- `.planning/PROJECT.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/phases/07-session-recovery-presence/07-RESEARCH.md`
- `.planning/phases/07-session-recovery-presence/07-VALIDATION.md`
- `AGENTS.md`

</sources>
