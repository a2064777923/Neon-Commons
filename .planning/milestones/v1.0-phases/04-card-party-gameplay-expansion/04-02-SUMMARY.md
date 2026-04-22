# 04-02 Summary

Status: Completed

## Outcome

Werewolf and Avalon room creation now supports curated `rolePack` presets plus the missing voice / hunter timing options, and the selected setup is visible both before room creation and inside the live party room. Undercover remained green as the shared party-manager regression guard.

## Delivered

- Added role-pack definitions, defaults, summaries, and helpers in [`lib/games/catalog.js`](/home/choinong/doudezhu/lib/games/catalog.js).
- Updated [`lib/party/manager.js`](/home/choinong/doudezhu/lib/party/manager.js) so Werewolf / Avalon role assignment depends on `gameKey + playerCount + rolePack`, with `normalizePartyConfig` exporting a real room-level config contract.
- Added focused coverage in [`test-logic/party-config.test.js`](/home/choinong/doudezhu/test-logic/party-config.test.js) and kept [`test-logic/undercover-logic.test.js`](/home/choinong/doudezhu/test-logic/undercover-logic.test.js) green.
- Exposed role-pack, voice, and hunter timing controls in [`pages/games/[gameKey].js`](/home/choinong/doudezhu/pages/games/[gameKey].js).
- Rendered the selected party setup summary in [`pages/party/[roomNo].js`](/home/choinong/doudezhu/pages/party/[roomNo].js).
- Extended browser coverage in [`tests/arcade-party.spec.js`](/home/choinong/doudezhu/tests/arcade-party.spec.js) and kept [`tests/undercover.spec.js`](/home/choinong/doudezhu/tests/undercover.spec.js) green.

## Verification

- `node --test test-logic/party-config.test.js test-logic/undercover-logic.test.js`
- `npm run check`
- `FRONTEND_BASE_URL=http://127.0.0.1:3310 npx playwright test tests/arcade-party.spec.js tests/undercover.spec.js --workers=1`
