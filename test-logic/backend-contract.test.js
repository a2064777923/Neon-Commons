const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const { createRouter } = require("../backend/router");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  API_ROUTES,
  SOCKET_EVENTS,
  getContractAuthScope
} = require("../lib/shared/network-contract");
const { getPartyRoomManager } = require("../lib/party/manager");
const { __testing: directoryTesting } = require("../lib/rooms/directory");
const {
  buildAvailabilityEnvelope,
  getDefaultAvailabilityControls
} = require("../lib/shared/availability");

const HANDLERS_DIR = path.join(__dirname, "..", "backend", "handlers");

test("shared API route patterns stay aligned with backend router inventory", () => {
  const router = createRouter(HANDLERS_DIR);
  const routePaths = new Set(router.routes.map((route) => route.routePath));
  const contractPaths = new Set(flattenStringValues(API_ROUTE_PATTERNS));

  for (const routePath of contractPaths) {
    assert.equal(
      routePaths.has(routePath),
      true,
      `Expected router to expose ${routePath}`
    );
  }
});

test("every backend handler exports explicit contract metadata", () => {
  const router = createRouter(HANDLERS_DIR);
  const routeByFile = new Map(router.routes.map((route) => [route.filePath, route]));
  const seenRouteMethods = new Set();

  for (const filePath of listHandlerFiles(HANDLERS_DIR)) {
    const loaded = require(filePath);
    const handler = loaded.default || loaded;
    const route = routeByFile.get(filePath);

    assert.ok(route, `Missing router record for ${filePath}`);
    assert.ok(handler.contract, `Missing handler.contract for ${filePath}`);
    assert.deepEqual(loaded.contract, handler.contract);
    assert.equal(handler.contract.path, route.routePath);
    assert.ok(handler.contract.id);
    assert.ok(handler.contract.methods.length > 0);

    for (const method of handler.contract.methods) {
      const auth = getContractAuthScope(handler.contract, method);
      assert.ok(
        Object.values(AUTH_SCOPES).includes(auth),
        `Unexpected auth scope for ${filePath} ${method}: ${auth}`
      );

      const routeMethodKey = `${handler.contract.path}:${method}`;
      assert.equal(
        seenRouteMethods.has(routeMethodKey),
        false,
        `Duplicate contract for ${routeMethodKey}`
      );
      seenRouteMethods.add(routeMethodKey);
    }
  }
});

test("shared socket event constants remain unique", () => {
  const values = flattenStringValues(SOCKET_EVENTS);
  assert.equal(new Set(values).size, values.length);
});

test("representative public, user, and admin routes keep expected method/auth behavior", async () => {
  const router = createRouter(HANDLERS_DIR);

  const loginResult = await invokeRoute(router, {
    method: "POST",
    url: API_ROUTES.auth.login(),
    body: {}
  });
  assert.equal(loginResult.statusCode, 400);
  assert.match(loginResult.json.error, /帳號|账号|密碼|密码/);

  const meResult = await invokeRoute(router, {
    method: "GET",
    url: API_ROUTES.me()
  });
  assert.equal(meResult.statusCode, 200);
  assert.equal(meResult.json.user, null);

  const adminResult = await invokeRoute(router, {
    method: "GET",
    url: API_ROUTES.admin.config()
  });
  assert.equal(adminResult.statusCode, 401);
  assert.match(adminResult.json.error, /未登入|登录已失效/);
});

test("runtime and room-entry handlers keep additive degraded-state payloads without changing route contracts", async () => {
  const availabilityControls = getDefaultAvailabilityControls();
  availabilityControls.families.party.voice = {
    state: "blocked",
    reasonCode: "party-voice-maintenance",
    message: "語音維護中，請先文字溝通。",
    safeActions: ["continue-text-only", "wait"],
    configured: true
  };

  await withPatchedModuleExports(
    [
      [
        "../lib/auth",
        {
          requireAdmin: async () => ({ id: 9, role: "admin" })
        }
      ],
      [
        "../lib/admin/control-plane",
        {
          getRuntimeControls: async () => ({
            maxOpenRoomsPerUser: 3,
            maintenanceMode: false
          }),
          getAvailabilityControls: async () => availabilityControls
        }
      ]
    ],
    async () => {
      const runtimeHandler = loadFreshModule("../backend/handlers/admin/runtime/index.js");
      const runtimeResponse = createHandlerResponse();

      await runtimeHandler({ method: "GET", headers: {} }, runtimeResponse);

      assert.equal(runtimeResponse.statusCode, 200);
      assert.ok(runtimeResponse.payload.availabilityControls);
      assert.ok(Array.isArray(runtimeResponse.payload.availabilityControlList));
      assert.equal(runtimeResponse.payload.availabilityControls.families.party.voice.state, "blocked");
    }
  );
});

test("shared availability contract keeps undercover voice guidance turn-aware", () => {
  const availabilityControls = getDefaultAvailabilityControls();
  availabilityControls.families.party.voice = {
    state: "degraded",
    reasonCode: "party-voice-unstable",
    message: "",
    safeActions: [],
    configured: true
  };

  const undercoverEnvelope = buildAvailabilityEnvelope({
    controls: availabilityControls,
    familyKey: "party",
    gameKey: "undercover",
    roomAvailability: "live",
    supportsVoice: true
  });
  const werewolfEnvelope = buildAvailabilityEnvelope({
    controls: availabilityControls,
    familyKey: "party",
    gameKey: "werewolf",
    roomAvailability: "live",
    supportsVoice: true
  });

  assert.deepEqual(undercoverEnvelope.subsystems.voice.safeActions, [
    "retry",
    "active-speaker-only"
  ]);
  assert.match(undercoverEnvelope.subsystems.voice.message, /輪到描述者再開咪/);
  assert.deepEqual(werewolfEnvelope.subsystems.voice.safeActions, [
    "retry",
    "continue-text-only"
  ]);
});

test("runtime voice degradation can elevate availability without weakening operator blocks", () => {
  const degradedEnvelope = buildAvailabilityEnvelope({
    controls: getDefaultAvailabilityControls(),
    familyKey: "party",
    gameKey: "werewolf",
    roomAvailability: "live",
    supportsVoice: true,
    runtimeVoiceState: {
      state: "degraded",
      reasonCode: "voice-relay-required",
      message: "語音已切換為穩定模式。"
    }
  });
  assert.equal(degradedEnvelope.subsystems.voice.state, "degraded");
  assert.equal(degradedEnvelope.subsystems.voice.reasonCode, "voice-relay-required");
  assert.match(degradedEnvelope.subsystems.voice.message, /穩定模式/);

  const blockedControls = getDefaultAvailabilityControls();
  blockedControls.families.party.voice = {
    state: "blocked",
    reasonCode: "party-voice-maintenance",
    message: "語音維護中，請先文字溝通。",
    safeActions: ["continue-text-only", "wait"],
    configured: true
  };
  const blockedEnvelope = buildAvailabilityEnvelope({
    controls: blockedControls,
    familyKey: "party",
    gameKey: "werewolf",
    roomAvailability: "live",
    supportsVoice: true,
    runtimeVoiceState: {
      state: "degraded",
      reasonCode: "voice-relay-required",
      message: "語音已切換為穩定模式。"
    }
  });

  assert.equal(blockedEnvelope.subsystems.voice.state, "blocked");
  assert.equal(blockedEnvelope.subsystems.voice.reasonCode, "party-voice-maintenance");
  assert.match(blockedEnvelope.subsystems.voice.message, /文字溝通/);
});

test("party room detail keeps additive voice transport and recovery fields", async (t) => {
  resetPartyRoomState();
  t.after(resetPartyRoomState);

  const manager = getPartyRoomManager();
  const owner = { id: 901, username: "owner901", displayName: "Owner 901" };
  const guest = { id: 902, username: "guest902", displayName: "Guest 902" };
  const room = manager.createRoom(owner, "werewolf", {
    visibility: "private",
    maxPlayers: 8
  });
  manager.joinRoom(room.roomNo, guest);
  room.runtimeVoiceState = {
    state: "degraded",
    reasonCode: "voice-relay-required",
    message: "語音已切換為穩定模式。"
  };

  await withPatchedModuleExports(
    [
      [
        "../lib/auth",
        {
          getSessionFromRequest: async () => ({ id: guest.id, kind: "user" })
        }
      ],
      [
        "../lib/admin/control-plane",
        {
          getAvailabilityControls: async () => getDefaultAvailabilityControls()
        }
      ]
    ],
    async () => {
      const handler = loadFreshModule("../backend/handlers/party/rooms/[roomNo]/index.js");
      const res = createHandlerResponse();

      await handler(
        {
          method: "GET",
          query: { roomNo: room.roomNo },
          headers: {}
        },
        res
      );

      assert.equal(res.statusCode, 200);
      assert.equal(res.payload.room.roomNo, room.roomNo);
      assert.ok(Array.isArray(res.payload.room.players));
      assert.equal(res.payload.room.voiceTransport.mode, "direct-preferred");
      assert.equal(res.payload.room.voiceTransport.runtimeState, "degraded");
      assert.equal(res.payload.room.voiceTransport.stickyRelay, true);
      assert.equal(res.payload.room.voiceTransport.startupProbeMs, 4000);
      assert.equal(res.payload.room.voiceTransport.persistentFailureMs, 6000);
      assert.equal(res.payload.room.voiceTransport.reconnectGraceSeconds, 45);
      assert.equal(res.payload.room.voiceTransport.resumeMutedOnRecovery, true);
      assert.deepEqual(res.payload.room.voiceTransport.iceServers, [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
      ]);
      assert.deepEqual(res.payload.room.viewer.voiceRecovery, {
        autoResumeEligible: false,
        resumeMuted: true,
        rejoinBy: null,
        lastMode: "direct-preferred"
      });
      assert.ok(res.payload.room.degradedState);
      assert.equal(res.payload.room.degradedState.subsystems.voice.state, "degraded");
      assert.equal(
        res.payload.room.degradedState.subsystems.voice.reasonCode,
        "voice-relay-required"
      );
    }
  );
});

test("party room voice reports promote sticky relay mode without reverting room transport", (t) => {
  resetPartyRoomState();
  t.after(resetPartyRoomState);

  const manager = getPartyRoomManager();
  const owner = { id: 911, username: "owner911", displayName: "Owner 911" };
  const room = manager.createRoom(owner, "werewolf", {
    visibility: "private",
    maxPlayers: 8
  });

  manager.reportVoiceTransport(room.roomNo, owner.id, {
    reason: "startup-timeout"
  });

  const serializedAfterStartupTimeout = manager.serializeRoom(room, owner.id);
  assert.equal(serializedAfterStartupTimeout.voiceTransport.mode, "relay-required");
  assert.equal(serializedAfterStartupTimeout.voiceTransport.stickyRelay, true);
  assert.equal(serializedAfterStartupTimeout.voiceTransport.runtimeState, "degraded");
  assert.equal(serializedAfterStartupTimeout.voiceTransport.lastReasonCode, "voice-startup-timeout");
  assert.ok(serializedAfterStartupTimeout.voiceTransport.lastTransitionAt);
  assert.equal(serializedAfterStartupTimeout.degradedState.subsystems.voice.state, "degraded");
  assert.equal(
    serializedAfterStartupTimeout.degradedState.subsystems.voice.reasonCode,
    "voice-startup-timeout"
  );

  manager.reportVoiceTransport(room.roomNo, owner.id, {
    reason: "persistent-disconnect"
  });

  const serializedAfterPersistentDisconnect = manager.serializeRoom(room, owner.id);
  assert.equal(serializedAfterPersistentDisconnect.voiceTransport.mode, "relay-required");
  assert.equal(
    serializedAfterPersistentDisconnect.voiceTransport.lastReasonCode,
    "voice-persistent-disconnect"
  );
});

test("socket server wires voice report events to the party room manager", async () => {
  const fakeRoomManager = {
    attachIo() {},
    unregisterSocket() {}
  };
  const fakeBoardManager = {
    attachIo() {},
    unregisterSocket() {}
  };
  const reported = [];
  const fakePartyManager = {
    attachIo() {},
    unregisterSocket() {},
    reportVoiceTransport(roomNo, userId, payload) {
      reported.push({ roomNo, userId, payload });
    }
  };
  const fakeIo = {
    middleware: null,
    connectionHandler: null,
    use(handler) {
      this.middleware = handler;
    },
    on(event, handler) {
      if (event === "connection") {
        this.connectionHandler = handler;
      }
    }
  };

  await withPatchedModuleExports(
    [
      [
        "../lib/auth",
        {
          getSessionFromRequest: async () => ({
            id: 712,
            kind: "user"
          })
        }
      ],
      [
        "../lib/game/room-manager",
        {
          getRoomManager: () => fakeRoomManager
        }
      ],
      [
        "../lib/board/manager",
        {
          getBoardRoomManager: () => fakeBoardManager
        }
      ],
      [
        "../lib/party/manager",
        {
          getPartyRoomManager: () => fakePartyManager
        }
      ]
    ],
    async () => {
      const { registerSocketHandlers } = loadFreshModule("../lib/socket-server");
      registerSocketHandlers(fakeIo);

      const socket = createMockSocketConnection("voice-report-socket");
      let middlewareError = null;
      await fakeIo.middleware(socket, (error) => {
        middlewareError = error || null;
      });
      assert.equal(middlewareError, null);

      fakeIo.connectionHandler(socket);
      socket.handlers[SOCKET_EVENTS.voice.report]({
        roomNo: "612345",
        reason: "startup-timeout"
      });

      assert.deepEqual(reported, [
        {
          roomNo: "612345",
          userId: 712,
          payload: {
            reason: "startup-timeout",
            reasonCode: undefined
          }
        }
      ]);
    }
  );
});

test("admin template updates reject unsupported LAIZI activation before persistence", async () => {
  const queries = [];

  await withPatchedModuleExports(
    [
      [
        "../lib/auth",
        {
          requireAdmin: async () => ({ id: 7, role: "admin" })
        }
      ],
      [
        "../lib/db",
        {
          query: async (sql, params = []) => {
            queries.push({ sql, params });
            if (sql.includes("FROM room_templates") && sql.includes("WHERE id = $1")) {
              return {
                rowCount: 1,
                rows: [
                  {
                    id: 9,
                    name: "laizi-beta",
                    title: "癩子實驗房",
                    description: "預留",
                    mode: "LAIZI",
                    is_active: false,
                    settings: {}
                  }
                ]
              };
            }

            throw new Error("unexpected query");
          }
        }
      ]
    ],
    async () => {
      const handler = loadFreshModule("../backend/handlers/admin/templates/index.js");
      const res = createHandlerResponse();

      await handler(
        {
          method: "PATCH",
          body: {
            id: 9,
            isActive: true
          }
        },
        res
      );

      assert.equal(res.statusCode, 400);
      assert.match(res.payload.error, /癩子/);
      assert.equal(queries.length, 1);
    }
  );
});

test("card room creation rejects unsupported template modes before room manager execution", async () => {
  let createRoomCalled = false;

  await withPatchedModuleExports(
    [
      [
        "../lib/auth",
        {
          requireUser: async () => ({ id: 11, username: "smoke", displayName: "Smoke" })
        }
      ],
      [
        "../lib/db",
        {
          query: async (sql) => {
            if (sql.includes("FROM room_templates")) {
              return {
                rowCount: 1,
                rows: [
                  {
                    id: 9,
                    name: "laizi-beta",
                    title: "癩子實驗房",
                    description: "預留",
                    mode: "LAIZI",
                    is_active: true,
                    settings: {}
                  }
                ]
              };
            }

            throw new Error("unexpected query");
          }
        }
      ],
      [
        "../lib/admin/control-plane",
        {
          getNewRoomControlSnapshot: async () => ({
            runtime: {
              maxOpenRoomsPerUser: 3
            }
          }),
          getNewRoomBlockedReason: () => null
        }
      ],
      [
        "../lib/game/room-manager",
        {
          getRoomManager: () => ({
            listPublicRooms() {
              return [];
            },
            countOpenRoomsByOwner() {
              return 0;
            },
            createRoom() {
              createRoomCalled = true;
              throw new Error("should not reach room manager");
            },
            serializeRoom() {
              return {};
            }
          })
        }
      ]
    ],
    async () => {
      const handler = loadFreshModule("../backend/handlers/rooms/index.js");
      const res = createHandlerResponse();

      await handler(
        {
          method: "POST",
          body: {
            templateId: 9,
            overrides: {}
          }
        },
        res
      );

      assert.equal(res.statusCode, 400);
      assert.match(res.payload.error, /癩子/);
      assert.equal(createRoomCalled, false);
    }
  );
});

function listHandlerFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listHandlerFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith(".js") ? [entryPath] : [];
  });
}

function flattenStringValues(value) {
  if (typeof value === "string") {
    return [value];
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.values(value).flatMap((entry) => flattenStringValues(entry));
}

function loadFreshModule(modulePath) {
  const resolved = require.resolve(modulePath, { paths: [__dirname] });
  delete require.cache[resolved];
  return require(resolved);
}

async function withPatchedModuleExports(patches, run) {
  const originals = [];

  try {
    for (const [modulePath, overrides] of patches) {
      const resolved = require.resolve(modulePath, { paths: [__dirname] });
      const loaded = require(resolved);
      const snapshot = {};

      for (const [key, value] of Object.entries(overrides)) {
        snapshot[key] = loaded[key];
        loaded[key] = value;
      }

      originals.push({ loaded, snapshot });
    }

    return await run();
  } finally {
    for (const { loaded, snapshot } of originals.reverse()) {
      for (const [key, value] of Object.entries(snapshot)) {
        loaded[key] = value;
      }
    }
  }
}

async function invokeRoute(router, { method, url, body, headers = {} }) {
  const requestBody =
    body === undefined ? null : Buffer.from(JSON.stringify(body), "utf8");

  const req = {
    method,
    url,
    headers: {
      host: "127.0.0.1:3101",
      ...(requestBody ? { "content-type": "application/json" } : {}),
      ...headers
    },
    async *[Symbol.asyncIterator]() {
      if (requestBody) {
        yield requestBody;
      }
    }
  };

  const res = createMockResponse();
  await router.handleRequest(req, res);

  return {
    statusCode: res.statusCode,
    headers: res.headers,
    json: res.body ? JSON.parse(res.body) : null
  };
}

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    headersSent: false,
    writableEnded: false,
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(payload = "") {
      this.body = payload;
      this.headersSent = true;
      this.writableEnded = true;
    }
  };
}

function clearTimerMap(timerMap) {
  if (!timerMap) {
    return;
  }

  for (const timer of timerMap.values()) {
    clearTimeout(timer);
  }
  timerMap.clear();
}

function resetPartyRoomState() {
  clearTimerMap(global.partyRoomManager?.reconnectTimers);
  clearTimerMap(global.partyRoomManager?.roomExpiryTimers);
  directoryTesting.resetRoomDirectory();
  delete global.partyRoomManager;
}

function createMockSocketConnection(id) {
  return {
    id,
    handshake: {
      headers: {}
    },
    handlers: {},
    emitted: [],
    join() {},
    on(event, handler) {
      this.handlers[event] = handler;
    },
    emit(event, payload) {
      this.emitted.push({ event, payload });
    }
  };
}

function createHandlerResponse() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = JSON.stringify(payload);
      this.payload = payload;
      return this;
    },
    end(payload = "") {
      this.body = payload;
      return this;
    }
  };
}
