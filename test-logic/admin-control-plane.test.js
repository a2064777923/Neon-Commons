const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const controlPlane = require("../lib/admin/control-plane");
const { getDefaultAvailabilityControls } = require("../lib/shared/availability");
const { __testing: roomTesting } = require("../lib/game/room-manager");

test("default capability families cover all managed games with new-room-only scope", () => {
  const state = controlPlane.normalizeCapabilityState({});
  const families = controlPlane.buildCapabilityFamilies(state);

  assert.deepEqual(
    families.map((family) => family.key),
    ["card", "party", "board", "solo"]
  );
  assert.equal(families[0].items[0].gameKey, "doudezhu");
  const managedItems = families
    .flatMap((family) => family.items)
    .filter((item) => item.appliesTo === "new-rooms-only");
  assert.equal(managedItems.every((item) => item.capabilityManaged), true);

  const sokoban = families
    .find((family) => family.key === "solo")
    .items.find((item) => item.gameKey === "sokoban");
  assert.equal(sokoban.appliesTo, "direct-launch");
  assert.equal(sokoban.launchMode, "direct");
  assert.equal(sokoban.enabled, true);
});

test("runtime control normalization keeps allowlisted values safe", () => {
  const runtime = controlPlane.normalizeRuntimeControls({
    maxOpenRoomsPerUser: "0",
    maintenanceMode: "true"
  });

  assert.equal(runtime.maxOpenRoomsPerUser, 3);
  assert.equal(runtime.maintenanceMode, true);
});

test("rollout normalization keeps catalog defaults and effective discovery states consistent", () => {
  const rolloutState = controlPlane.normalizeRolloutState({
    drawguess: "playable",
    uno: "paused-new-rooms"
  });

  assert.equal(rolloutState.drawguess, "playable");
  assert.equal(rolloutState.uno, "paused-new-rooms");
  assert.equal(controlPlane.normalizeRolloutState({}).drawguess, "coming-soon");
  assert.equal(
    controlPlane.getDiscoveryState(
      "drawguess",
      controlPlane.normalizeCapabilityState({ drawguess: true }),
      rolloutState
    ),
    "paused-new-rooms"
  );

  const families = controlPlane.buildRolloutFamilies(
    controlPlane.normalizeCapabilityState({ werewolf: true, drawguess: true }),
    rolloutState
  );
  const drawguess = families
    .find((family) => family.key === "party")
    .items.find((item) => item.gameKey === "drawguess");
  const werewolf = families
    .find((family) => family.key === "party")
    .items.find((item) => item.gameKey === "werewolf");
  const uno = families
    .find((family) => family.key === "card")
    .items.find((item) => item.gameKey === "uno");

  assert.equal(drawguess.rolloutState, "playable");
  assert.equal(drawguess.state, "paused-new-rooms");
  assert.equal(drawguess.stateSource, "admin-override");
  assert.equal(werewolf.state, "playable");
  assert.equal(uno.rolloutState, "paused-new-rooms");
  assert.equal(uno.state, "paused-new-rooms");
});

test("availability control normalization keeps subsystem defaults and scoped overrides safe", () => {
  const controls = getDefaultAvailabilityControls();
  assert.equal(controls.global.entry.state, "healthy");
  assert.equal(controls.families.party.voice.configured, false);

  const updates = controlPlane.normalizeAvailabilityUpdates([
    {
      scope: "family",
      familyKey: "party",
      subsystem: "voice",
      state: "blocked",
      reason: "語音維護",
      reasonCode: "party-voice-maintenance",
      safeActions: ["continue-text-only", "wait"]
    }
  ]);

  assert.deepEqual(updates[0], {
    scope: "family",
    familyKey: "party",
    subsystem: "voice",
    state: "blocked",
    reasonCode: "party-voice-maintenance",
    message: "",
    safeActions: ["continue-text-only", "wait"],
    reason: "語音維護"
  });
});

test("capability update validation rejects unknown games", () => {
  assert.throws(
    () =>
      controlPlane.normalizeCapabilityUpdates([
        { gameKey: "mahjong", enabled: false }
      ]),
    /未知遊戲能力/
  );
});

test("runtime update validation rejects unknown keys and invalid values", () => {
  assert.throws(
    () =>
      controlPlane.normalizeRuntimeUpdates([
        { key: "allowPublicRoomList", value: false }
      ]),
    /未知運行配置/
  );

  assert.throws(
    () =>
      controlPlane.normalizeRuntimeUpdates([
        { key: "maxOpenRoomsPerUser", value: 0 }
      ]),
    /maxOpenRoomsPerUser/
  );

  assert.throws(
    () =>
      controlPlane.normalizeAvailabilityUpdates([
        { scope: "family", familyKey: "solo", subsystem: "voice", state: "blocked" }
      ]),
    /未知降級範圍/
  );
});

test("capabilities handler requires admin auth", async () => {
  const handler = loadWithMocks(
    "./backend/handlers/admin/capabilities/index.js",
    {
      "./lib/auth": {
        requireAdmin: async (_req, res) => {
          res.status(401).json({ error: "未登入或登入已失效" });
          return null;
        }
      },
      "./lib/db": { query: async () => ({ rows: [] }) }
    }
  );

  const response = createMockResponse();
  await handler({ method: "GET", headers: {} }, response);

  assert.equal(response.statusCode, 401);
  assert.match(response.jsonBody.error, /未登入/);
});

test("capabilities handler GET returns grouped families and PATCH supports rollout updates", async () => {
  const recordedLogDetails = [];
  const storedConfigs = new Map([
    ["gameCapabilities", { werewolf: false, drawguess: true }],
    ["gameRolloutStates", { drawguess: "coming-soon" }]
  ]);
  const handler = loadWithMocks(
    "./backend/handlers/admin/capabilities/index.js",
    {
      "./lib/auth": {
        requireAdmin: async () => ({ id: 7, role: "admin" })
      },
      "./lib/db": {
        query: async (text, params = []) => {
          if (String(text).includes("INSERT INTO admin_logs")) {
            recordedLogDetails.push(JSON.parse(params[3]));
            return { rows: [] };
          }

          if (String(text).includes("INSERT INTO system_configs")) {
            storedConfigs.set(params[0], JSON.parse(params[1]));
            return { rows: [] };
          }

          if (Array.isArray(params[0])) {
            return {
              rows: params[0]
                .filter((key) => storedConfigs.has(key))
                .map((key) => ({
                  key,
                  value: storedConfigs.get(key)
                }))
            };
          }

          return { rows: [] };
        }
      }
    }
  );

  const getResponse = createMockResponse();
  await handler({ method: "GET", headers: {} }, getResponse);

  assert.equal(getResponse.statusCode, 200);
  const partyFamily = getResponse.jsonBody.families.find((family) => family.key === "party");
  const werewolf = partyFamily.items.find((item) => item.gameKey === "werewolf");
  const rolloutPartyFamily = getResponse.jsonBody.rolloutFamilies.find(
    (family) => family.key === "party"
  );
  const drawguess = rolloutPartyFamily.items.find((item) => item.gameKey === "drawguess");
  assert.equal(werewolf.enabled, false);
  assert.equal(drawguess.rolloutState, "coming-soon");
  assert.equal(getResponse.jsonBody.rolloutSummary.counts["coming-soon"] >= 1, true);

  const validPatchResponse = createMockResponse();
  await handler(
    {
      method: "PATCH",
      body: {
        updates: [{ gameKey: "werewolf", enabled: true, reason: "恢復開放" }]
      },
      headers: {}
    },
    validPatchResponse
  );

  assert.equal(validPatchResponse.statusCode, 200);
  assert.deepEqual(recordedLogDetails[0].target, ["werewolf"]);
  assert.equal(recordedLogDetails[0].scope, "capabilities");
  assert.equal(recordedLogDetails[0].before.werewolf, false);
  assert.equal(recordedLogDetails[0].after.werewolf, true);
  assert.equal(recordedLogDetails[0].reason, "恢復開放");
  assert.equal(recordedLogDetails[0].appliesTo, "new-rooms-only");

  const rolloutPatchResponse = createMockResponse();
  await handler(
    {
      method: "PATCH",
      body: {
        rolloutUpdates: [
          {
            gameKey: "drawguess",
            state: "paused-new-rooms",
            reason: "第二波預演"
          }
        ]
      },
      headers: {}
    },
    rolloutPatchResponse
  );

  assert.equal(rolloutPatchResponse.statusCode, 200);
  const patchedDrawguess = rolloutPatchResponse.jsonBody.rolloutFamilies
    .find((family) => family.key === "party")
    .items.find((item) => item.gameKey === "drawguess");
  assert.equal(patchedDrawguess.rolloutState, "paused-new-rooms");
  assert.equal(patchedDrawguess.state, "paused-new-rooms");
  assert.deepEqual(recordedLogDetails[1].target, ["drawguess"]);
  assert.equal(recordedLogDetails[1].scope, "rollout");
  assert.equal(recordedLogDetails[1].reason, "第二波預演");
  assert.equal(recordedLogDetails[1].appliesTo, "discovery-state");
  assert.deepEqual(recordedLogDetails[1].state, ["paused-new-rooms"]);

  const patchResponse = createMockResponse();
  await handler(
    {
      method: "PATCH",
      body: {
        updates: [{ gameKey: "mahjong", enabled: false }]
      },
      headers: {}
    },
    patchResponse
  );

  assert.equal(patchResponse.statusCode, 400);
  assert.match(patchResponse.jsonBody.error, /未知遊戲能力/);
});

test("runtime handler GET returns controls, health snapshot, and PATCH validates keys", async () => {
  const recordedLogDetails = [];
  const storedConfigs = new Map([
    ["runtimeControls", { maxOpenRoomsPerUser: 5, maintenanceMode: true }]
  ]);
  const handler = loadWithMocks(
    "./backend/handlers/admin/runtime/index.js",
    {
      "./lib/auth": {
        requireAdmin: async () => ({ id: 9, role: "admin" })
      },
      "./lib/db": {
        query: async (text, params = []) => {
          if (String(text).includes("INSERT INTO admin_logs")) {
            recordedLogDetails.push(JSON.parse(params[3]));
            return { rows: [] };
          }

          if (String(text).includes("INSERT INTO system_configs")) {
            storedConfigs.set(params[0], JSON.parse(params[1]));
            return { rows: [] };
          }

          if (Array.isArray(params[0])) {
            return {
              rows: params[0]
                .filter((key) => storedConfigs.has(key))
                .map((key) => ({
                  key,
                  value: storedConfigs.get(key)
                }))
            };
          }

          return { rows: [] };
        }
      }
    }
  );

  const getResponse = createMockResponse();
  await handler({ method: "GET", headers: {} }, getResponse);

  assert.equal(getResponse.statusCode, 200);
  assert.equal(
    getResponse.jsonBody.controls.find((item) => item.key === "maxOpenRoomsPerUser").value,
    5
  );
  assert.equal(getResponse.jsonBody.availabilityControls.global.entry.state, "healthy");
  assert.equal(getResponse.jsonBody.availabilityControlList.length, 12);
  assert.equal(getResponse.jsonBody.healthSnapshot.overallState, "healthy");
  assert.deepEqual(
    getResponse.jsonBody.healthSnapshot.cards.map((card) => card.key),
    ["entry", "realtime", "voice", "rollout"]
  );

  const validPatchResponse = createMockResponse();
  await handler(
    {
      method: "PATCH",
      body: {
        updates: [{ key: "maintenanceMode", value: false, reason: "結束維護" }]
      },
      headers: {}
    },
    validPatchResponse
  );

  assert.equal(validPatchResponse.statusCode, 200);
  assert.deepEqual(recordedLogDetails[0].target, ["maintenanceMode"]);
  assert.equal(recordedLogDetails[0].scope, "runtime");
  assert.equal(recordedLogDetails[0].before.maintenanceMode, true);
  assert.equal(recordedLogDetails[0].after.maintenanceMode, false);
  assert.equal(recordedLogDetails[0].reason, "結束維護");
  assert.equal(recordedLogDetails[0].appliesTo, "new-rooms-only");
  assert.equal(validPatchResponse.jsonBody.availabilityControls.global.entry.state, "healthy");
  assert.equal(validPatchResponse.jsonBody.healthSnapshot.cards[0].key, "entry");

  const availabilityPatchResponse = createMockResponse();
  await handler(
    {
      method: "PATCH",
      body: {
        availabilityUpdates: [
          {
            scope: "family",
            familyKey: "party",
            subsystem: "voice",
            state: "blocked",
            reason: "語音維護",
            reasonCode: "party-voice-maintenance",
            safeActions: ["continue-text-only", "wait"]
          }
        ]
      },
      headers: {}
    },
    availabilityPatchResponse
  );

  assert.equal(availabilityPatchResponse.statusCode, 200);
  assert.equal(
    availabilityPatchResponse.jsonBody.availabilityControls.families.party.voice.state,
    "blocked"
  );
  assert.deepEqual(
    availabilityPatchResponse.jsonBody.availabilityControls.families.party.voice.safeActions,
    ["continue-text-only", "wait"]
  );
  assert.equal(recordedLogDetails[1].scope, "availability-controls");
  assert.deepEqual(recordedLogDetails[1].target, ["party:voice"]);
  assert.deepEqual(recordedLogDetails[1].appliesTo, ["family:party"]);
  assert.deepEqual(recordedLogDetails[1].subsystem, ["voice"]);
  assert.deepEqual(recordedLogDetails[1].state, ["blocked"]);
  assert.equal(
    availabilityPatchResponse.jsonBody.healthSnapshot.cards.find((card) => card.key === "voice")
      .state,
    "blocked"
  );

  const patchResponse = createMockResponse();
  await handler(
    {
      method: "PATCH",
      body: {
        updates: [{ key: "unknownKey", value: 1 }]
      },
      headers: {}
    },
    patchResponse
  );

  assert.equal(patchResponse.statusCode, 400);
  assert.match(patchResponse.jsonBody.error, /未知運行配置/);
});

test("logs handler requires admin auth", async () => {
  const handler = loadWithMocks(
    "./backend/handlers/admin/logs/index.js",
    {
      "./lib/auth": {
        requireAdmin: async (_req, res) => {
          res.status(401).json({ error: "未登入或登入已失效" });
          return null;
        }
      },
      "./lib/db": { query: async () => ({ rows: [] }) }
    }
  );

  assert.equal(handler.contract.path, "/api/admin/logs");

  const response = createMockResponse();
  await handler({ method: "GET", headers: {} }, response);

  assert.equal(response.statusCode, 401);
  assert.match(response.jsonBody.error, /未登入/);
});

test("logs handler GET returns recent entries with actor context", async () => {
  const handler = loadWithMocks(
    "./backend/handlers/admin/logs/index.js",
    {
      "./lib/auth": {
        requireAdmin: async () => ({ id: 9, role: "admin" })
      },
      "./lib/db": {
        query: async () => ({
          rows: [
            {
              id: 18,
              operator_user_id: 9,
              target_user_id: null,
              action: "update-runtime",
              detail: {
                scope: "runtime",
                target: ["maintenanceMode"],
                before: { maintenanceMode: false },
                after: { maintenanceMode: true },
                reason: "夜間維護",
                appliesTo: "new-rooms-only"
              },
              created_at: "2026-04-22T10:00:00.000Z",
              operator_display_name: "Admin",
              operator_username: "admin",
              target_display_name: null,
              target_username: null
            }
          ]
        })
      }
    }
  );

  const response = createMockResponse();
  await handler({ method: "GET", headers: {} }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.jsonBody.items[0].operator.displayName, "Admin");
  assert.equal(response.jsonBody.items[0].detail.appliesTo, "new-rooms-only");
  assert.deepEqual(response.jsonBody.items[0].detail.target, ["maintenanceMode"]);
});

test("player adjust handler records standardized audit payload", async () => {
  const recordedLogDetails = [];
  const handler = loadWithMocks(
    "./backend/handlers/admin/players/[id]/adjust.js",
    {
      "./lib/auth": {
        requireAdmin: async () => ({ id: 3, role: "admin" })
      },
      "./lib/db": {
        query: async (text, params = []) => {
          if (String(text).includes("SELECT * FROM users")) {
            return {
              rowCount: 1,
              rows: [
                {
                  id: 7,
                  coins: 100,
                  rank_score: 50,
                  status: "active"
                }
              ]
            };
          }

          if (String(text).includes("UPDATE users")) {
            return {
              rows: [
                {
                  id: 7,
                  coins: 600,
                  rank_score: 70,
                  status: "blocked"
                }
              ]
            };
          }

          if (String(text).includes("INSERT INTO admin_logs")) {
            recordedLogDetails.push(JSON.parse(params[3]));
            return { rows: [] };
          }

          return { rows: [] };
        }
      }
    }
  );

  const response = createMockResponse();
  await handler(
    {
      method: "POST",
      query: { id: "7" },
      body: {
        coinsDelta: 500,
        rankDelta: 20,
        status: "blocked",
        reason: "manual-review"
      },
      headers: {}
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(recordedLogDetails[0].scope, "players");
  assert.deepEqual(recordedLogDetails[0].target, ["user:7"]);
  assert.deepEqual(recordedLogDetails[0].before, {
    coins: 100,
    rankScore: 50,
    status: "active"
  });
  assert.deepEqual(recordedLogDetails[0].after, {
    coins: 600,
    rankScore: 70,
    status: "blocked"
  });
  assert.equal(recordedLogDetails[0].reason, "manual-review");
  assert.equal(recordedLogDetails[0].appliesTo, "immediate-player-state");
});

test("card room create handler blocks maintenance mode for new rooms", async () => {
  const handler = loadWithMocks(
    "./backend/handlers/rooms/index.js",
    {
      "./lib/auth": {
        requireUser: async () => ({ id: 11, username: "tester", displayName: "Tester" })
      },
      "./lib/db": {
        query: async (_text, params = []) => {
          if (Array.isArray(params[0])) {
            return {
              rows: [
                {
                  key: "runtimeControls",
                  value: { maxOpenRoomsPerUser: 3, maintenanceMode: true }
                },
                {
                  key: "gameCapabilities",
                  value: { doudezhu: true }
                }
              ]
            };
          }

          return { rows: [] };
        }
      }
    }
  );

  const response = createMockResponse();
  await handler(
    {
      method: "POST",
      body: { templateId: 1 },
      headers: {}
    },
    response
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.jsonBody.error, "系統維護中，暫停新建房間");
});

test("party room create handler blocks disabled games for new rooms", async () => {
  const handler = loadWithMocks(
    "./backend/handlers/party/rooms/index.js",
    {
      "./lib/auth": {
        requireUser: async () => ({ id: 15, username: "tester", displayName: "Tester" })
      },
      "./lib/db": {
        query: async (_text, params = []) => {
          if (Array.isArray(params[0])) {
            return {
              rows: [
                {
                  key: "runtimeControls",
                  value: { maxOpenRoomsPerUser: 3, maintenanceMode: false }
                },
                {
                  key: "gameCapabilities",
                  value: { werewolf: false }
                }
              ]
            };
          }

          return { rows: [] };
        }
      }
    }
  );

  const response = createMockResponse();
  await handler(
    {
      method: "POST",
      query: { gameKey: "werewolf" },
      body: { config: {} },
      headers: {}
    },
    response
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.jsonBody.error, "該遊戲目前未開放新房");
});

test("party room create handler blocks rollout-paused games for new rooms", async () => {
  const handler = loadWithMocks(
    "./backend/handlers/party/rooms/index.js",
    {
      "./lib/auth": {
        requireUser: async () => ({ id: 16, username: "tester2", displayName: "Tester 2" })
      },
      "./lib/db": {
        query: async (_text, params = []) => {
          if (Array.isArray(params[0])) {
            return {
              rows: [
                {
                  key: "runtimeControls",
                  value: { maxOpenRoomsPerUser: 3, maintenanceMode: false }
                },
                {
                  key: "gameCapabilities",
                  value: { werewolf: true }
                },
                {
                  key: "gameRolloutStates",
                  value: { werewolf: "paused-new-rooms" }
                }
              ]
            };
          }

          return { rows: [] };
        }
      }
    }
  );

  const response = createMockResponse();
  await handler(
    {
      method: "POST",
      query: { gameKey: "werewolf" },
      body: { config: {} },
      headers: {}
    },
    response
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.jsonBody.error, "該遊戲目前未開放新房");
});

test("existing rooms still serialize after capability state changes elsewhere", () => {
  const manager = new roomTesting.RoomManager();
  const room = manager.createRoom(
    { id: 21, username: "owner", displayName: "Owner" },
    {
      id: 1,
      name: "classic-ranked",
      title: "經典排位房",
      mode: "CLASSIC",
      settings: { baseScore: 50, countdownSeconds: 18, roomVisibility: "public" }
    }
  );

  const disabledSnapshot = controlPlane.normalizeCapabilityState({ doudezhu: false });
  assert.equal(disabledSnapshot.doudezhu, false);

  const serialized = manager.serializeRoom(room, 21);
  assert.equal(serialized.roomNo, room.roomNo);
  assert.equal(serialized.mode, "CLASSIC");
});

function loadWithMocks(modulePath, mocks) {
  const root = path.resolve(__dirname, "..");
  const resolvedModulePath = require.resolve(path.join(root, modulePath));
  const resolvedMocks = Object.entries(mocks).map(([relativePath, mockExports]) => ({
    resolvedDependency: require.resolve(path.join(root, relativePath)),
    mockExports
  }));

  for (const cacheKey of Object.keys(require.cache)) {
    if (!cacheKey.startsWith(root) || cacheKey === __filename) {
      continue;
    }

    delete require.cache[cacheKey];
  }

  for (const { resolvedDependency, mockExports } of resolvedMocks) {
    require.cache[resolvedDependency] = {
      id: resolvedDependency,
      filename: resolvedDependency,
      loaded: true,
      exports: mockExports
    };
  }

  delete require.cache[resolvedModulePath];
  return require(resolvedModulePath);
}

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    jsonBody: null,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.jsonBody = payload;
      return this;
    }
  };
}
