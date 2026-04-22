const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const {
  decodeSessionToken,
  GUEST_SCOPE_ERROR,
  signGuestToken
} = require("../lib/auth");
const controlPlane = require("../lib/admin/control-plane");
const {
  __testing: directoryTesting,
  listShareableRoomsForUser,
  resolveRoomEntry
} = require("../lib/rooms/directory");
const { getRoomManager } = require("../lib/game/room-manager");
const { getBoardRoomManager } = require("../lib/board/manager");
const { getPartyRoomManager } = require("../lib/party/manager");
const { SOCKET_EVENTS } = require("../lib/shared/network-contract");

test("discovery catalog surfaces approved upcoming games and exact hub card states", () => {
  const capabilities = controlPlane.normalizeCapabilityState({ werewolf: false });
  const families = controlPlane.buildHubFamilies(capabilities, {
    roomCounts: { werewolf: 1, doudezhu: 2 }
  });

  assert.deepEqual(
    families.map((family) => family.familyKey),
    ["card", "party", "board", "solo", "light-3d"]
  );

  const titles = new Set(
    families.flatMap((family) => family.items.map((item) => item.title))
  );
  for (const expected of [
    "UNO 類",
    "誰是臥底",
    "你畫我猜",
    "黑白棋",
    "飛行棋",
    "推箱子",
    "保齡球",
    "迷你賽車/碰碰車"
  ]) {
    assert.equal(titles.has(expected), true, `missing discovery title: ${expected}`);
  }

  const werewolf = families
    .find((family) => family.familyKey === "party")
    .items.find((item) => item.gameKey === "werewolf");
  assert.equal(werewolf.state, "paused-new-rooms");
  assert.equal(werewolf.stateLabel, "暫停新房");
  assert.equal(werewolf.roomCount, 1);
  assert.equal(werewolf.supportsShareLink, true);
  assert.equal(werewolf.guestMode, "invite-private-only");

  const doudezhu = families
    .find((family) => family.familyKey === "card")
    .items.find((item) => item.gameKey === "doudezhu");
  assert.equal(doudezhu.state, "playable");
  assert.equal(doudezhu.guestMode, "login-only");

  const uno = families
    .find((family) => family.familyKey === "card")
    .items.find((item) => item.gameKey === "uno");
  assert.equal(uno.state, "coming-soon");
  assert.equal(uno.stateLabel, "即將推出");

  const undercover = families
    .find((family) => family.familyKey === "party")
    .items.find((item) => item.gameKey === "undercover");
  assert.equal(undercover.state, "playable");
  assert.equal(undercover.route, "/games/undercover");
  assert.equal(undercover.detailRoutePrefix, "/undercover");
  assert.equal(undercover.supportsShareLink, true);

  const reversi = families
    .find((family) => family.familyKey === "board")
    .items.find((item) => item.gameKey === "reversi");
  assert.equal(reversi.state, "playable");
  assert.equal(reversi.route, "/games/reversi");
  assert.equal(reversi.detailRoutePrefix, "/reversi");
  assert.equal(reversi.supportsShareLink, true);

  const sokoban = families
    .find((family) => family.familyKey === "solo")
    .items.find((item) => item.gameKey === "sokoban");
  assert.equal(sokoban.state, "playable");
  assert.equal(sokoban.route, "/games/sokoban");
  assert.equal(sokoban.launchMode, "direct");
  assert.equal(sokoban.supportsShareLink, false);
});

test("admin capability responses include family discovery metadata", async () => {
  const handler = loadWithMocks("./backend/handlers/admin/capabilities/index.js", {
    "./lib/auth": {
      requireAdmin: async () => ({ id: 1, role: "admin" })
    },
    "./lib/db": {
      query: async (_text, params = []) => {
        if (Array.isArray(params[0])) {
          return {
            rows: [
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
  });

  const response = createMockResponse();
  await handler({ method: "GET", headers: {} }, response);

  assert.equal(response.statusCode, 200);
  const werewolf = response.jsonBody.families
    .find((family) => family.key === "party")
    .items.find((item) => item.gameKey === "werewolf");

  assert.equal(werewolf.familyKey, "party");
  assert.equal(werewolf.familyLabel, "推理派對");
  assert.equal(werewolf.state, "paused-new-rooms");
  assert.equal(werewolf.stateLabel, "暫停新房");
  assert.equal(werewolf.supportsShareLink, true);
  assert.equal(werewolf.guestMode, "invite-private-only");

  const soloFamily = response.jsonBody.families.find((family) => family.key === "solo");
  const sokoban = soloFamily.items.find((item) => item.gameKey === "sokoban");
  assert.equal(sokoban.state, "playable");
  assert.equal(sokoban.launchMode, "direct");
  assert.equal(sokoban.appliesTo, "direct-launch");
});

test("shared room directory allocates unique room numbers across families and resolves routes", () => {
  resetLiveRoomState();

  const cardManager = getRoomManager();
  const partyManager = getPartyRoomManager();
  const owner = { id: 41, username: "owner41", displayName: "Owner 41" };
  const joiner = { id: 52, username: "joiner52", displayName: "Joiner 52" };

  const cardRoom = cardManager.createRoom(
    owner,
    {
      id: 1,
      name: "classic",
      title: "經典桌",
      mode: "CLASSIC",
      settings: {
        baseScore: 50,
        countdownSeconds: 18,
        autoTrusteeMinSeconds: 2,
        autoTrusteeMaxSeconds: 5,
        roomVisibility: "public"
      }
    },
    {}
  );
  const partyRoom = partyManager.createRoom(owner, "werewolf", {
    visibility: "private",
    maxPlayers: 8
  });
  partyManager.joinRoom(partyRoom.roomNo, joiner);

  assert.match(cardRoom.roomNo, /^\d{6}$/);
  assert.match(partyRoom.roomNo, /^\d{6}$/);
  assert.notEqual(cardRoom.roomNo, partyRoom.roomNo);

  const cardEntry = resolveRoomEntry(cardRoom.roomNo);
  const partyEntry = resolveRoomEntry(partyRoom.roomNo);

  assert.equal(cardEntry.familyKey, "card");
  assert.equal(cardEntry.detailRoute, `/room/${cardRoom.roomNo}`);
  assert.equal(cardEntry.joinRoute, `/api/rooms/${cardRoom.roomNo}/join`);
  assert.equal(cardEntry.guestAllowed, false);

  assert.equal(partyEntry.familyKey, "party");
  assert.equal(partyEntry.detailRoute, `/party/${partyRoom.roomNo}`);
  assert.equal(partyEntry.joinRoute, `/api/party/rooms/${partyRoom.roomNo}/join`);
  assert.equal(partyEntry.guestAllowed, true);

  const shareableRooms = listShareableRoomsForUser(joiner.id);
  assert.equal(shareableRooms.length, 1);
  assert.equal(shareableRooms[0].roomNo, partyRoom.roomNo);
  assert.equal(shareableRooms[0].gameKey, "werewolf");
});

test("room-entry resolve and shareable handlers return exact deep-link payloads", async () => {
  resetLiveRoomState();

  const partyManager = getPartyRoomManager();
  const owner = { id: 61, username: "owner61", displayName: "Owner 61" };
  const joiner = { id: 62, username: "joiner62", displayName: "Joiner 62" };
  const partyRoom = partyManager.createRoom(owner, "werewolf", {
    visibility: "private",
    maxPlayers: 8
  });
  partyManager.joinRoom(partyRoom.roomNo, joiner);

  const resolveHandler = loadWithMocks("./backend/handlers/room-entry/resolve.js", {});
  const resolveResponse = createMockResponse();
  await resolveHandler(
    {
      method: "GET",
      query: { roomNo: partyRoom.roomNo },
      headers: {}
    },
    resolveResponse
  );

  assert.equal(resolveResponse.statusCode, 200);
  assert.deepEqual(Object.keys(resolveResponse.jsonBody).slice(0, 8), [
    "familyKey",
    "gameKey",
    "roomNo",
    "detailRoute",
    "joinRoute",
    "roomState",
    "visibility",
    "guestAllowed"
  ]);
  assert.equal(resolveResponse.jsonBody.shareUrl, `/entry/werewolf/${partyRoom.roomNo}`);

  const shareableHandler = loadWithMocks("./backend/handlers/room-entry/shareable.js", {
    "./lib/auth": {
      requireUser: async () => joiner
    }
  });
  const shareableResponse = createMockResponse();
  await shareableHandler({ method: "GET", headers: {} }, shareableResponse);

  assert.equal(shareableResponse.statusCode, 200);
  assert.equal(shareableResponse.jsonBody.items.length, 1);
  assert.equal(shareableResponse.jsonBody.items[0].roomNo, partyRoom.roomNo);
  assert.equal(shareableResponse.jsonBody.items[0].shareUrl, `/entry/werewolf/${partyRoom.roomNo}`);
});

test("paused-new-room games keep existing rooms joinable while new creation stays blocked", async () => {
  resetLiveRoomState();

  const partyManager = getPartyRoomManager();
  const owner = { id: 71, username: "owner71", displayName: "Owner 71" };
  const joiner = { id: 72, username: "joiner72", displayName: "Joiner 72" };
  const existingRoom = partyManager.createRoom(owner, "werewolf", {
    visibility: "private",
    maxPlayers: 8
  });

  const resolveHandler = loadWithMocks("./backend/handlers/room-entry/resolve.js", {});
  const resolveResponse = createMockResponse();
  await resolveHandler(
    {
      method: "GET",
      query: { roomNo: existingRoom.roomNo, gameKeyHint: "werewolf" },
      headers: {}
    },
    resolveResponse
  );
  assert.equal(resolveResponse.statusCode, 200);
  assert.equal(resolveResponse.jsonBody.familyKey, "party");

  const joinHandler = loadWithMocks("./backend/handlers/party/rooms/[roomNo]/join.js", {
    "./lib/auth": {
      requireUser: async () => joiner
    }
  });
  const joinResponse = createMockResponse();
  await joinHandler(
    {
      method: "POST",
      query: { roomNo: existingRoom.roomNo },
      headers: {}
    },
    joinResponse
  );

  assert.equal(joinResponse.statusCode, 200);
  assert.equal(joinResponse.jsonBody.room.roomNo, existingRoom.roomNo);

  const createHandler = loadWithMocks("./backend/handlers/party/rooms/index.js", {
    "./lib/auth": {
      requireUser: async () => owner
    },
    "./lib/admin/control-plane": {
      getNewRoomControlSnapshot: async () => ({
        capabilities: { werewolf: false },
        runtime: { maxOpenRoomsPerUser: 3, maintenanceMode: false }
      }),
      getNewRoomBlockedReason: () => "該遊戲目前未開放新房"
    }
  });
  const createResponse = createMockResponse();
  await createHandler(
    {
      method: "POST",
      query: {},
      body: {
        gameKey: "werewolf",
        config: { visibility: "private", maxPlayers: 8 }
      },
      headers: {}
    },
    createResponse
  );

  assert.equal(createResponse.statusCode, 400);
  assert.equal(createResponse.jsonBody.error, "該遊戲目前未開放新房");
});

test("guest mint succeeds for eligible private rooms and rejects Dou Dizhu/public flows", async () => {
  resetLiveRoomState();

  const boardManager = getBoardRoomManager();
  const cardManager = getRoomManager();
  const owner = { id: 81, username: "owner81", displayName: "Owner 81" };
  const privateBoardRoom = boardManager.createRoom(owner, "gomoku", {
    visibility: "private",
    maxPlayers: 2
  });
  const publicBoardRoom = boardManager.createRoom(owner, "gomoku", {
    visibility: "public",
    maxPlayers: 2
  });
  const privateCardRoom = cardManager.createRoom(
    owner,
    {
      id: 2,
      name: "private-classic",
      title: "私密經典桌",
      mode: "CLASSIC",
      settings: {
        baseScore: 50,
        countdownSeconds: 18,
        autoTrusteeMinSeconds: 2,
        autoTrusteeMaxSeconds: 5,
        roomVisibility: "private"
      }
    },
    {}
  );

  const guestHandler = loadWithMocks("./backend/handlers/room-entry/guest.js", {});

  const successResponse = createMockResponse();
  await guestHandler(
    {
      method: "POST",
      body: {
        roomNo: privateBoardRoom.roomNo,
        gameKey: "gomoku",
        displayName: "客人甲"
      },
      headers: {}
    },
    successResponse
  );

  assert.equal(successResponse.statusCode, 200);
  const guestToken = extractCookieToken(successResponse.headers["set-cookie"]);
  const guestPayload = decodeSessionToken(guestToken);
  assert.equal(guestPayload.kind, "guest");
  assert.equal(guestPayload.gameKey, "gomoku");
  assert.equal(guestPayload.roomNo, privateBoardRoom.roomNo);
  assert.equal(successResponse.jsonBody.room.viewer.displayName, "客人甲");

  const publicResponse = createMockResponse();
  await guestHandler(
    {
      method: "POST",
      body: {
        roomNo: publicBoardRoom.roomNo,
        gameKey: "gomoku"
      },
      headers: {}
    },
    publicResponse
  );

  assert.equal(publicResponse.statusCode, 400);
  assert.equal(publicResponse.jsonBody.error, "遊客僅可通過私密邀請入場");

  const cardResponse = createMockResponse();
  await guestHandler(
    {
      method: "POST",
      body: {
        roomNo: privateCardRoom.roomNo,
        gameKey: "doudezhu"
      },
      headers: {}
    },
    cardResponse
  );

  assert.equal(cardResponse.statusCode, 400);
  assert.equal(cardResponse.jsonBody.error, "當前房間不支持遊客加入");
});

test("guest-sync writes guest_match_links claims", async () => {
  const queries = [];
  const handler = loadWithMocks("./backend/handlers/room-entry/guest-sync.js", {
    "./lib/auth": {
      requireUser: async () => ({ id: 91, role: "player", status: "active" })
    },
    "./lib/db": {
      query: async (text, params = []) => {
        queries.push({ text: String(text), params });
        return {
          rows: [
            {
              id: 5,
              guest_id: params[0],
              claimed_user_id: params[1],
              game_key: params[2],
              room_no: params[3],
              summary: JSON.parse(params[4]),
              created_at: "2026-04-22T03:00:00.000Z",
              claimed_at: "2026-04-22T03:01:00.000Z"
            }
          ]
        };
      }
    }
  });

  const response = createMockResponse();
  await handler(
    {
      method: "POST",
      body: {
        guestId: "guest_sync_1",
        gameKey: "werewolf",
        roomNo: "612345",
        summary: { headline: "正義方勝出" }
      },
      headers: {}
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(queries.length, 1);
  assert.match(queries[0].text, /INSERT INTO guest_match_links/);
  assert.equal(response.jsonBody.claim.guestId, "guest_sync_1");
  assert.equal(response.jsonBody.claim.claimedUserId, 91);
  assert.equal(response.jsonBody.claim.summary.headline, "正義方勝出");
});

test("guest sockets are rejected outside their scoped room", async () => {
  resetLiveRoomState();

  const partyManager = getPartyRoomManager();
  const owner = { id: 101, username: "owner101", displayName: "Owner 101" };
  const scopedRoom = partyManager.createRoom(owner, "werewolf", {
    visibility: "private",
    maxPlayers: 8
  });
  const otherRoom = partyManager.createRoom(owner, "werewolf", {
    visibility: "private",
    maxPlayers: 8
  });

  const calls = [];
  const fakePartyManager = createMockPartyManager(calls);
  const { registerSocketHandlers } = loadWithMocks("./lib/socket-server.js", {
    "./lib/game/room-manager": {
      getRoomManager: () => createMockCardManager()
    },
    "./lib/board/manager": {
      getBoardRoomManager: () => createMockBoardManager()
    },
    "./lib/party/manager": {
      getPartyRoomManager: () => fakePartyManager
    }
  });

  const ioHarness = createIoHarness();
  registerSocketHandlers(ioHarness.io);

  const token = signGuestToken({
    guestId: "guest_socket_1",
    displayName: "Guest Socket",
    gameKey: "werewolf",
    roomNo: scopedRoom.roomNo
  });
  const socket = await ioHarness.connect(token);

  socket.handlers[SOCKET_EVENTS.party.subscribe]({ roomNo: scopedRoom.roomNo });
  assert.deepEqual(calls, [["register", scopedRoom.roomNo, "guest_socket_1"]]);

  socket.handlers[SOCKET_EVENTS.party.subscribe]({ roomNo: otherRoom.roomNo });
  assert.equal(calls.length, 1);
  assert.equal(socket.emitted.at(-1).event, SOCKET_EVENTS.party.error);
  assert.equal(socket.emitted.at(-1).payload.error, GUEST_SCOPE_ERROR);
});

test("/api/hub returns unified family discovery payload without hiding paused live rooms", async () => {
  const handler = loadWithMocks("./backend/handlers/hub.js", {
    "./lib/db": {
      query: async (text, params = []) => {
        if (String(text).includes("FROM system_configs")) {
          return {
            rows: [
              {
                key: "gameCapabilities",
                value: { werewolf: false }
              }
            ]
          };
        }

        if (String(text).includes("FROM users")) {
          return {
            rows: [
              {
                id: 9,
                username: "arcade-alpha",
                display_name: "Arcade Alpha",
                avatar_url: null,
                coins: 9800,
                rank_score: 1230,
                wins: 12,
                losses: 4,
                total_games: 16
              }
            ]
          };
        }

        return { rows: [] };
      }
    },
    "./lib/game/room-manager": {
      getRoomManager: () => ({
        listPublicRooms: () => []
      })
    },
    "./lib/party/manager": {
      getPartyRoomManager: () => ({
        listPublicRooms: () => [
          {
            roomNo: "310001",
            gameKey: "werewolf",
            title: "狼人夜局",
            strapline: "高壓發言局",
            state: "waiting",
            config: { visibility: "public", maxPlayers: 8 },
            playerCount: 6,
            createdAt: "2026-04-22T01:00:00.000Z"
          }
        ]
      })
    },
    "./lib/board/manager": {
      getBoardRoomManager: () => ({
        listPublicRooms: () => []
      })
    }
  });

  const response = createMockResponse();
  await handler({ method: "GET", headers: {} }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(Object.keys(response.jsonBody), [
    "families",
    "liveFeed",
    "featuredRooms",
    "leaderboardPreview",
    "universalEntry",
    "capabilitySummary"
  ]);

  const werewolf = response.jsonBody.families
    .find((family) => family.familyKey === "party")
    .items.find((item) => item.gameKey === "werewolf");
  assert.equal(werewolf.state, "paused-new-rooms");
  assert.equal(werewolf.stateLabel, "暫停新房");
  assert.equal(werewolf.roomCount, 1);
  assert.equal(werewolf.sharePath, "/entry/werewolf/{roomNo}");

  assert.equal(response.jsonBody.liveFeed.length, 1);
  assert.equal(response.jsonBody.liveFeed[0].roomNo, "310001");
  assert.equal(response.jsonBody.liveFeed[0].detailRoute, "/party/310001");
  assert.equal(response.jsonBody.featuredRooms[0].roomNo, "310001");

  assert.equal(response.jsonBody.universalEntry.heading, "遊戲入口");
  assert.equal(response.jsonBody.universalEntry.modes[0].label, "房號加入");
  assert.equal(response.jsonBody.capabilitySummary.counts["coming-soon"], 5);
});

function resetLiveRoomState() {
  directoryTesting.resetRoomDirectory();
  delete global.ddzRoomManager;
  delete global.partyRoomManager;
  delete global.boardRoomManager;
}

function extractCookieToken(setCookie) {
  const serialized = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return String(serialized || "")
    .split(";")[0]
    .split("=")
    .slice(1)
    .join("=");
}

function createIoHarness() {
  const middlewares = [];
  let connectionHandler = null;

  return {
    io: {
      use(handler) {
        middlewares.push(handler);
      },
      on(event, handler) {
        if (event === "connection") {
          connectionHandler = handler;
        }
      },
      to() {
        return {
          emit() {}
        };
      }
    },
    async connect(token) {
      const socket = createMockSocket(token);

      for (const middleware of middlewares) {
        const error = await new Promise((resolve) => {
          middleware(socket, resolve);
        });
        if (error) {
          throw error;
        }
      }

      connectionHandler(socket);
      return socket;
    }
  };
}

function createMockSocket(token) {
  return {
    id: `socket_${Math.random().toString(36).slice(2, 8)}`,
    handshake: {
      headers: {
        cookie: `ddz_token=${token}`
      }
    },
    handlers: {},
    emitted: [],
    on(event, handler) {
      this.handlers[event] = handler;
    },
    emit(event, payload) {
      this.emitted.push({ event, payload });
    },
    join(roomName) {
      this.joinedRoom = roomName;
    }
  };
}

function createMockCardManager() {
  return {
    attachIo() {},
    registerSocket() {},
    setReady() {},
    addBot() {},
    submitBid() {},
    submitPlay() {},
    pass() {},
    toggleTrustee() {},
    sendChat() {},
    unregisterSocket() {}
  };
}

function createMockBoardManager() {
  return {
    attachIo() {},
    registerSocket() {},
    setReady() {},
    addBot() {},
    submitMove() {},
    unregisterSocket() {}
  };
}

function createMockPartyManager(calls) {
  return {
    attachIo() {},
    registerSocket(roomNo, userId) {
      calls.push(["register", roomNo, userId]);
    },
    setReady() {},
    addBot() {},
    sendRoomMessage() {},
    submitAction() {},
    voiceJoin() {},
    voiceLeave() {},
    updateVoiceState() {},
    relayVoiceSignal() {},
    unregisterSocket() {}
  };
}

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
