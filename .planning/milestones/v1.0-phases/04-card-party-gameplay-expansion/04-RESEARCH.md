# Phase 4: Card & Party Gameplay Expansion - Research

**Researched:** 2026-04-22
**Domain:** Incremental expansion of shipped Dou Dizhu, Werewolf, and Avalon gameplay through the existing room/template contracts
**Confidence:** HIGH

<user_constraints>
## User Constraints

- Phase 4 goal from `.planning/ROADMAP.md`: extend live rules, roles, templates, and interactions for Dou Dizhu, Werewolf, and Avalon without breaking shipped match flow.
- Phase requirements are fixed as `CARD-01` and `PARTY-01`; planning must cover both explicitly.
- Phase 03 and 03.1 already established the compatibility baseline: shared hub metadata, room-number/invite entry, and the currently shipped room families must remain intact.
- `AGENTS.md` requires preserving the frontend/backend split. Backend changes belong in `backend/handlers/**` or shared modules, not `pages/api`.
- Existing room-number join, live Socket.IO room behavior, and dedicated backend handlers remain the brownfield compatibility target.
- New work should expand shipped gameplay and admin/back-office capability incrementally, not re-platform card or party systems into a new architecture.
</user_constraints>

<current_state_audit>
## Current State Audit

### Dou Dizhu already has a template-backed foundation

- `lib/defaults.js` seeds four templates: active `classic-ranked`, `rob-fast`, `no-shuffle-social`, and inactive `laizi-beta`.
- `backend/handlers/templates.js` exposes template data publicly for the lobby, and `backend/handlers/admin/templates/index.js` lets admins create/patch templates through the backend.
- `pages/lobby.js` already consumes template data and lets players override a small subset of settings at room creation time.
- `pages/room/[roomNo].js` already renders room state, bid options, multipliers, trustee, and the real-time card flow, so it is the correct place to surface richer rule information once the backend contract is stronger.

### Dou Dizhu rule plumbing is still incomplete

- `pickAllowedOverrides()` in `lib/game/room-manager.js` accepts `baseScore`, countdown/trustee timing, visibility, `allowBots`, and multiplier overrides, but it does not accept seeded settings such as `allowSpring`, `allowBomb`, `allowRocket`, or `maxRobMultiplier`.
- `normalizeRoomSettings()` only normalizes `baseScore`, countdown/trustee timing, and visibility. It does not normalize the rest of the seeded template settings.
- `submitPlay()` already multiplies on bombs and rockets, and `finishGame()` already applies spring doubling, but those paths do not currently honor `allowBomb`, `allowRocket`, or `allowSpring`.
- Automated bidding in `performAutomatedAction()` still hard-codes a max bid ceiling of `3`, even though templates already seed `maxRobMultiplier`.
- `lib/game/cards.js` only implements `CLASSIC` and `NO_SHUFFLE` deck behavior. `LAIZI` is seeded as an inactive template but the card/deck/combo engine does not yet support it safely.
- `backend/handlers/admin/templates/index.js` persists raw template settings JSON without a shared validator, so admins can store settings that the actual room runtime only partially understands.

### Werewolf and Avalon already have deeper runtime logic than the lobby exposes

- `lib/party/manager.js` already implements richer Werewolf roles (`seer`, `witch`, `guard`, `hunter`) and richer Avalon roles (`percival`, `morgana`, `mordred`, `oberon`) in addition to the core roles.
- `pages/party/[roomNo].js` already understands Werewolf and Avalon phase-specific room rendering and already reacts to `voiceEnabled`.
- `lib/games/catalog.js` already exposes per-game defaults including `hunterSeconds` for Werewolf and `voiceEnabled` for party rooms.
- `backend/handlers/party/rooms/index.js` already passes room config through the existing live party-room model, so Phase 4 does not need a new party creation path.

### Party configuration is still too rigid for Phase 4

- `pages/games/[gameKey].js` only exposes player count, visibility, and timer fields for Werewolf/Avalon. It does not expose role-pack choices, `hunterSeconds`, or voice toggles even though some of those values already exist in backend defaults/runtime.
- `buildWerewolfRoles(playerCount)` and `buildAvalonRoles(playerCount)` in `lib/party/manager.js` still derive roles from hard-coded player-count tables, not from room-level role configuration.
- `normalizePartyConfig()` only branches on `gameKey` for timers; it does not carry a role preset or richer phase option contract.
- `pages/party/[roomNo].js` shows live phase state but does not clearly surface which role pack or room options were selected when the room was created.
- `undercover` now exists in the shared party manager and has its own shipped route. Any party-manager refactor in Phase 4 must preserve Undercover as a regression target even though it is not the feature focus.
</current_state_audit>

<recommended_direction>
## Recommended Direction

### 1. Expand Dou Dizhu through a schema-backed rule surface, not a new card runtime

Phase 4 should treat the existing template system as the delivery vehicle for `CARD-01`:

- add one shared settings normalizer/validator for supported Dou Dizhu template fields
- use that normalizer in default seeds, admin template create/patch, public template listing, room creation, and room runtime serialization
- promote already-seeded rule flags into real behavior: `allowBomb`, `allowRocket`, `allowSpring`, `maxRobMultiplier`, `bidOptions`, and the existing multiplier fields
- surface the resulting rule set in the lobby and room UI so players understand which table they are joining

This is the lowest-risk path because the room template, lobby, and room runtime already exist. The gap is contract completeness, not the absence of a card-room architecture.

### 2. Keep `LAIZI` explicitly out of Phase 4 execution scope

`lib/defaults.js` already seeds `laizi-beta`, but `lib/game/cards.js` does not implement a laizi deck mode and the combo/runtime code is not yet shaped around wildcard behavior. The correct Phase 4 move is:

- keep `laizi-beta` inactive
- make backend validation reject unsupported mode activation for live rooms
- document in plan scope that Phase 4 expands supported rules inside `CLASSIC`, `ROB`, and `NO_SHUFFLE` only

That keeps the template system honest and avoids shipping a mode flag that the engine cannot uphold.

### 3. Use curated role presets for Werewolf and Avalon instead of free-form role toggles

The current party runtime already contains the hard parts of advanced roles. What is missing is room-level configurability. The safest delivery shape is:

- introduce one `rolePack` or similarly named preset field per game
- keep the preset set small and curated rather than allowing arbitrary role combinations
- default the shipped behavior to the current richer preset so existing rooms do not regress
- add at least one lower-complexity alternative preset so room owners can choose simpler tables without rewriting the manager

This matches the existing role-table architecture better than fully free-form toggles and still satisfies `PARTY-01` by making richer roles/options room-configurable through the existing create-room flow.

### 4. Surface missing party-room options that the runtime already partially supports

Phase 4 should expose room options that are already meaningful in current code:

- Werewolf: `rolePack`, `hunterSeconds`, `voiceEnabled`
- Avalon: `rolePack`, `voiceEnabled`

This keeps the create-room UI aligned with actual runtime capability instead of leaving advanced settings hidden in defaults only.

### 5. Keep party room rendering unified, but add explicit setup summaries

`pages/party/[roomNo].js` is still the right room shell for Werewolf and Avalon. The recommended change is not a new page, but:

- show selected role pack / enabled special roles in the room header or setup panel
- keep phase-specific action boards intact
- preserve existing `/party/{roomNo}` routing and invite/guest semantics
- treat Undercover as a regression surface only

### 6. Close the phase with a true regression gate across card, party, and template admin flows

Both planned execution branches change shared live room managers. Final validation should therefore include:

- Dou Dizhu logic and room smoke
- Werewolf/Avalon room creation + live room smoke
- Undercover smoke as a non-focus regression guard
- admin template editing smoke because template/rule expansion changes the admin write path
- backend/client contract node tests because room config payloads and handler behavior are touched
</recommended_direction>

<phase_shape_recommendation>
## Recommended Phase Shape

Use the roadmap's **3 plans**:

1. **04-01: Extend Dou Dizhu templates, rules, and interaction surface**
   - backend template validation and room-rule enforcement
   - lobby/room/admin visibility for the supported rule contract
   - explicit guard against unsupported `LAIZI` activation

2. **04-02: Extend Werewolf/Avalon role and phase capability**
   - curated room-level role presets
   - missing party options exposed through the existing create-room flow
   - party-room setup summaries and regression-safe manager updates

3. **04-03: Validate stability of card and party game regressions after expansion**
   - broaden logic/contract coverage for the new config surfaces
   - run combined Playwright smokes across DDZ, Werewolf/Avalon, Undercover, and admin template editing

Recommended execution order:

- Run **04-01** and **04-02** in parallel because their write sets are largely disjoint.
- Run **04-03** after both land as the ship gate for Phase 4.
</phase_shape_recommendation>

## Validation Architecture

### Fast feedback

- `npm run check`
- `node --test test-logic/ddz-logic.test.js`
- `node --test test-logic/party-config.test.js test-logic/undercover-logic.test.js`

### Wave-level validation

- `npm run check && node --test test-logic/backend-contract.test.js test-logic/client-network-contract.test.js test-logic/ddz-logic.test.js test-logic/party-config.test.js test-logic/undercover-logic.test.js`

### High-risk smoke validation

- `npx playwright test tests/room-ui.spec.js --workers=1`
- `npx playwright test tests/arcade-party.spec.js tests/undercover.spec.js --workers=1`
- `npx playwright test tests/admin-console.spec.js --workers=1`

### Expected artifacts

- a shared Dou Dizhu template/rule normalizer used by backend handlers and room runtime
- broader Dou Dizhu rule enforcement for supported template fields
- richer Dou Dizhu lobby/room/admin surfaces that describe the applied rule set
- a config-aware Werewolf/Avalon role-pack contract
- `test-logic/party-config.test.js` for role-pack normalization/distribution
- expanded DDZ and party smoke coverage for the new room options

## Open Questions

1. **Should Phase 4 activate `laizi-beta` now?**
   - What we know: the template exists, but the current deck/runtime does not implement a laizi mode.
   - Recommendation: no. Keep it inactive and make validation explicit so the admin surface cannot accidentally treat it as supported.

2. **Should Werewolf/Avalon use free-form role toggles or curated presets?**
   - What we know: current role assignment is table-driven by player count, and the current runtime already supports a finite set of advanced roles.
   - Recommendation: curated presets. They fit the existing architecture, keep validation tractable, and still deliver meaningful room-level choice.

3. **Does the admin template editor need a full bespoke form in Phase 4?**
   - What we know: there is already a raw JSON editor in `pages/admin/index.js`, and the real problem is missing schema validation.
   - Recommendation: no full form required in this phase. Add validation plus clearer preview/help so admins can safely use the existing workflow.

<sources>
## Sources

### Primary (HIGH confidence)
- `lib/defaults.js`
- `lib/game/cards.js`
- `lib/game/room-manager.js`
- `pages/lobby.js`
- `pages/room/[roomNo].js`
- `backend/handlers/templates.js`
- `backend/handlers/admin/templates/index.js`
- `backend/handlers/rooms/index.js`
- `lib/games/catalog.js`
- `lib/party/manager.js`
- `pages/games/[gameKey].js`
- `pages/party/[roomNo].js`
- `backend/handlers/party/rooms/index.js`
- `test-logic/ddz-logic.test.js`
- `test-logic/backend-contract.test.js`
- `test-logic/client-network-contract.test.js`
- `test-logic/undercover-logic.test.js`
- `tests/room-ui.spec.js`
- `tests/arcade-party.spec.js`
- `tests/undercover.spec.js`
- `tests/admin-console.spec.js`

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/PROJECT.md`
- `AGENTS.md`
</sources>
