# Phase 3: Hub & Room Expansion Framework - Pattern Map

**Mapped:** 2026-04-22
**Files analyzed:** 13
**Analogs found:** 13 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/games/catalog.js` | utility | transform | `lib/games/catalog.js` | exact |
| `lib/admin/control-plane.js` | service | CRUD + transform | `lib/admin/control-plane.js` | exact |
| `lib/shared/network-contract.js` | utility | request-response contract | `lib/shared/network-contract.js` | exact |
| `lib/rooms/directory.js` | service | event-driven + request-response | `lib/admin/control-plane.js` + room managers | role-match |
| `backend/handlers/hub.js` | route | request-response | `backend/handlers/me.js` + `backend/handlers/admin/logs/index.js` | role-match |
| `backend/handlers/room-entry/resolve.js` | route | request-response | `backend/handlers/rooms/[roomNo]/join.js` | role-match |
| `backend/handlers/room-entry/guest.js` | route | request-response | `backend/handlers/auth/login.js` | role-match |
| `backend/handlers/room-entry/shareable.js` | route | request-response | `backend/handlers/admin/logs/index.js` | role-match |
| `pages/index.js` | page component | request-response + polling | `pages/index.js` | exact |
| `pages/games/[gameKey].js` | page component | request-response + form workflow | `pages/games/[gameKey].js` | exact |
| `pages/entry/[gameKey]/[roomNo].js` | page component | request-response + redirect orchestration | `pages/login.js` + room pages | role-match |
| `components/MatchResultOverlay.js` | component | modal/action surface | `components/MatchResultOverlay.js` | exact |
| `test-logic/hub-room-entry.test.js` | test | handler + helper coverage | `test-logic/admin-control-plane.test.js` | exact |
| `tests/hub-entry.spec.js` | browser test | end-to-end smoke | `tests/arcade-party.spec.js` | exact |

## Pattern Assignments

### `lib/games/catalog.js` / discovery metadata helpers

**Analog:** `lib/games/catalog.js`

**Pattern to keep**
- Export plain-object catalogs plus named helper functions with CommonJS.
- Keep shipped-game definitions in a central `GAME_CATALOG` object and derive family helpers from that inventory.

**Code to copy**
```js
const GAME_CATALOG = {
  werewolf: {
    key: "werewolf",
    title: "在线狼人杀",
    route: "/games/werewolf"
  }
};

function getGameMeta(gameKey) {
  return GAME_CATALOG[gameKey] || null;
}
```

**Apply to Phase 3**
- Add family and discovery metadata in the same module rather than scattering it into pages.
- Keep helper names imperative and narrow: `getGameMeta`, `getGameMode`, `buildDiscoveryFamilies`, `getUpcomingGames`.

### `lib/admin/control-plane.js` / capability overlay logic

**Analog:** `lib/admin/control-plane.js`

**Pattern to keep**
- Normalize persisted JSON values with explicit allowlists.
- Expose small pure helpers plus async persistence functions.

**Code to copy**
```js
function normalizeCapabilityUpdates(updates) {
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new Error("至少提供一項能力更新");
  }
}

async function getNewRoomControlSnapshot() {
  const [capabilities, runtime] = await Promise.all([
    getCapabilityState(),
    getRuntimeControls()
  ]);
  return { capabilities, runtime };
}
```

**Apply to Phase 3**
- Add hub-facing state synthesis as new helpers in this module instead of duplicating it in `pages/index.js`.
- Keep shipped-game gating derived from `capabilities` booleans; future-title `coming-soon` data should remain non-persistent catalog metadata.

### `lib/shared/network-contract.js` / route builder additions

**Analog:** `lib/shared/network-contract.js`

**Pattern to keep**
- Add both `API_ROUTE_PATTERNS` and `API_ROUTES` entries together.
- Use `buildPath()` for params and query shaping.

**Code to copy**
```js
const API_ROUTE_PATTERNS = Object.freeze({
  admin: Object.freeze({
    capabilities: "/api/admin/capabilities"
  })
});

const API_ROUTES = Object.freeze({
  admin: Object.freeze({
    capabilities: () => API_ROUTE_PATTERNS.admin.capabilities
  })
});
```

**Apply to Phase 3**
- Introduce `hub` and `roomEntry.*` builders here first so both backend handlers and frontend pages stay synchronized.

### `backend/handlers/*.js` / request-response handlers

**Analogs:** `backend/handlers/me.js`, `backend/handlers/admin/logs/index.js`, `backend/handlers/rooms/[roomNo]/join.js`

**Pattern to keep**
- One handler per file, `methodNotAllowed()` for unsupported verbs, `createHandlerContract()` metadata beside the handler.
- Return localized JSON error messages directly from the handler.

**Code to copy**
```js
if (req.method !== "GET") {
  return methodNotAllowed(res, ["GET"]);
}

handler.contract = createHandlerContract(
  "admin.logs",
  API_ROUTE_PATTERNS.admin.logs,
  ["GET"],
  AUTH_SCOPES.ADMIN
);
```

**Apply to Phase 3**
- `hub.js` should behave like a public read endpoint.
- `room-entry/resolve.js`, `guest.js`, and `shareable.js` should mirror the join/auth handlers: guard early, return one JSON payload, and keep contract metadata explicit.

### `pages/index.js` / homepage orchestration

**Analog:** `pages/index.js`

**Pattern to keep**
- Fetch data in one `load*` helper and refresh with interval polling.
- Use CSS modules for layout composition and keep cards data-driven via `useMemo`.

**Code to copy**
```js
useEffect(() => {
  loadHubData()
    .then(...)
    .catch(() => null);

  const timer = setInterval(() => {
    loadHubData().then(...).catch(() => null);
  }, 8000);

  return () => clearInterval(timer);
}, []);
```

**Apply to Phase 3**
- Replace page-local aggregation with one hub payload, but preserve the existing polling/update rhythm.
- Keep the main page as a pure renderer of backend-owned discovery state.

### `pages/games/[gameKey].js` / family lobby workflow

**Analog:** `pages/games/[gameKey].js`

**Pattern to keep**
- Keep one page that derives behavior from `gameKey`, `getGameMeta`, and `getGameMode`.
- Local quick join and create-room form live side-by-side.

**Code to copy**
```js
const meta = useMemo(() => getGameMeta(gameKey), [gameKey]);
const gameMode = useMemo(() => getGameMode(gameKey), [gameKey]);

async function joinRoom(roomNo) {
  const response = await apiFetch(getJoinRoute(gameMode, roomNo), { method: "POST" });
}
```

**Apply to Phase 3**
- Keep the one-page family pattern; only add pause banners, share actions, and return-path cues.

### `pages/login.js` / redirect-after-auth

**Analog:** `pages/login.js`

**Pattern to keep**
- Submit via `apiFetch()`, parse JSON, then route with `router.push(...)`.

**Code to copy**
```js
const response = await apiFetch(API_ROUTES.auth.login(), {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(form)
});
```

**Apply to Phase 3**
- Preserve the same form contract and only add `returnTo` routing logic after success.

### `components/MatchResultOverlay.js` / result CTA extension

**Analog:** `components/MatchResultOverlay.js`

**Pattern to keep**
- Optional action slots controlled entirely by props.
- Reusable overlay component shared by card, party, and board rooms.

**Code to copy**
```js
{(secondaryAction || primaryAction) ? (
  <div className={styles.actionRow}>
    ...
  </div>
) : null}
```

**Apply to Phase 3**
- Add guest sync CTA through props instead of duplicating post-match UI inside each room page.

### `test-logic/*.test.js` / handler mocking

**Analog:** `test-logic/admin-control-plane.test.js`

**Pattern to keep**
- `node:test` + `node:assert/strict`
- module-load-with-mocks helper for handler testing
- direct JSON body/status assertions

**Code to copy**
```js
test("capabilities handler requires admin auth", async () => {
  const handler = loadWithMocks("./backend/handlers/admin/capabilities/index.js", { ... });
  const response = createMockResponse();
  await handler({ method: "GET", headers: {} }, response);
  assert.equal(response.statusCode, 401);
});
```

**Apply to Phase 3**
- Use the same pattern for `/api/hub`, room-entry resolve/shareable/guest routes, and room-directory helpers.

### `tests/*.spec.js` / Playwright smoke coverage

**Analogs:** `tests/arcade-party.spec.js`, `tests/board-games.spec.js`, `tests/room-ui.spec.js`

**Pattern to keep**
- Use direct `page.goto("http://127.0.0.1:3100/...")` flows
- Assert exact headings, buttons, and URL shapes
- Drive one end-to-end happy path per major room family

**Code to copy**
```js
await page.goto("http://127.0.0.1:3100/login");
await page.getByRole("button", { name: "登入" }).click();
await expect(page).toHaveURL("http://127.0.0.1:3100/");
```

**Apply to Phase 3**
- `tests/hub-entry.spec.js` should follow the same smoke philosophy: one homepage family-state flow and one invite-entry flow, not a sprawling UI tour.

## Shared Patterns

### Session refresh pattern

**Source:** `components/SiteLayout.js`

```js
useEffect(() => {
  function handleSessionUpdate(event) {
    setUser(event.detail || null);
  }

  window.addEventListener("session:user-updated", handleSessionUpdate);
  return () => window.removeEventListener("session:user-updated", handleSessionUpdate);
}, []);
```

**Apply to:** homepage, entry page, login redirect handoff

### Public-vs-auth handler split

**Source:** `backend/handlers/rooms/index.js`

```js
if (req.method === "GET") {
  return res.status(200).json({ items: roomManager.listPublicRooms() });
}

const user = await requireUser(req, res);
if (!user) {
  return undefined;
}
```

**Apply to:** room-entry resolve/shareable/guest handlers where some verbs are public and others are auth-scoped

### Localized inline error handling

**Source:** room join handlers and login page

```js
if (!response.ok) {
  setError(data.error || "加入房间失败");
  return;
}
```

**Apply to:** entry page resolve/join/guest flows and paused-state family lobby CTAs

## No Analog Found

- `lib/rooms/directory.js` does not have a direct existing analog. Build it in the style of `lib/admin/control-plane.js`: singleton-style module, explicit helper exports, no page-local state assumptions.
