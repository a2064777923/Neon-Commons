const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const {
  decodeSessionToken,
  GUEST_SCOPE_ERROR,
  signGuestToken,
  serializeSessionForClient
} = require("../lib/auth");
const controlPlane = require("../lib/admin/control-plane");
const {
  ROOM_DIRECTORY_SNAPSHOT_SOURCES,
  __testing: directoryTesting,
  listShareableRoomsForUser,
  registerRoomEntry,
  resolveRoomEntry
} = require("../lib/rooms/directory");
const { getRoomManager } = require("../lib/game/room-manager");
const { getBoardRoomManager } = require("../lib/board/manager");
const { getPartyRoomManager } = require("../lib/party/manager");
const { getDefaultAvailabilityControls } = require("../lib/shared/availability");
const { SOCKET_EVENTS } = require("../lib/shared/network-contract");

function createAvailabilityControlPlaneMock(overrides = {}) {
  return {
    getAvailabilityControls: async () => getDefaultAvailabilityControls(),
    ...overrides
  };
}

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

  const resolveHandler = loadWithMocks("./backend/handlers/room-entry/resolve.js", {
    "./lib/admin/control-plane": createAvailabilityControlPlaneMock()
  });
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
  assert.deepEqual(Object.keys(resolveResponse.jsonBody).slice(0, 9), [
    "familyKey",
    "gameKey",
    "roomNo",
    "detailRoute",
    "joinRoute",
    "availability",
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

  const resolveHandler = loadWithMocks("./backend/handlers/room-entry/resolve.js", {
    "./lib/admin/control-plane": createAvailabilityControlPlaneMock()
  });
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

test("scoped guest reconnect reuses the same party seat through the socket lifecycle", async () => {
  resetLiveRoomState();

  const partyManager = getPartyRoomManager();
  partyManager.reconnectGraceMs = 25;

  const owner = { id: 111, username: "owner111", displayName: "Owner 111" };
  const guestUser = {
    id: "guest_socket_recovery",
    username: "guest_socket_recovery",
    displayName: "Guest Recovery"
  };
  const room = partyManager.createRoom(owner, "werewolf", {
    visibility: "private",
    maxPlayers: 8
  });
  partyManager.joinRoom(room.roomNo, guestUser);

  const { registerSocketHandlers } = loadWithMocks("./lib/socket-server.js", {});
  const ioHarness = createIoHarness();
  registerSocketHandlers(ioHarness.io);

  const token = signGuestToken({
    guestId: guestUser.id,
    displayName: guestUser.displayName,
    gameKey: "werewolf",
    roomNo: room.roomNo
  });

  const socketOne = await ioHarness.connect(token);
  socketOne.handlers[SOCKET_EVENTS.party.subscribe]({ roomNo: room.roomNo });

  assert.equal(
    partyManager.getRoom(room.roomNo).players.filter((player) => player.userId === guestUser.id).length,
    1
  );
  assert.equal(
    partyManager.serializeRoom(partyManager.getRoom(room.roomNo), guestUser.id).viewer.presenceState,
    "connected"
  );

  socketOne.handlers.disconnect();
  assert.equal(
    partyManager.serializeRoom(partyManager.getRoom(room.roomNo), guestUser.id).viewer.presenceState,
    "reconnecting"
  );

  const socketTwo = await ioHarness.connect(token);
  socketTwo.handlers[SOCKET_EVENTS.party.subscribe]({ roomNo: room.roomNo });

  assert.equal(
    partyManager.getRoom(room.roomNo).players.filter((player) => player.userId === guestUser.id).length,
    1
  );
  assert.equal(
    partyManager.serializeRoom(partyManager.getRoom(room.roomNo), guestUser.id).viewer.presenceState,
    "connected"
  );
  assert.equal(
    resolveRoomEntry(room.roomNo).memberIds.filter((memberId) => memberId === guestUser.id).length,
    1
  );
});

test("/api/me exposes recovery metadata for user and scoped guest sessions", async () => {
  const userSession = {
    kind: "user",
    id: 121,
    username: "owner121",
    displayName: "Owner 121",
    role: "player",
    status: "active"
  };
  const guestSession = {
    kind: "guest",
    id: "guest_me_1",
    guestId: "guest_me_1",
    username: "guest_me_1",
    displayName: "Guest Me",
    role: "guest",
    status: "guest",
    gameKey: "werewolf",
    roomNo: "612345"
  };

  const handler = loadWithMocks("./backend/handlers/me.js", {
    "./lib/auth": {
      getSessionFromRequest: async (req) =>
        req.headers["x-session-kind"] === "guest" ? guestSession : userSession,
      serializeSessionForClient
    }
  });

  const userResponse = createMockResponse();
  await handler({ method: "GET", headers: {} }, userResponse);

  assert.equal(userResponse.statusCode, 200);
  assert.equal(userResponse.jsonBody.session.presenceState, "connected");
  assert.equal(userResponse.jsonBody.session.recoveryEligible, true);
  assert.equal(userResponse.jsonBody.session.reconnectGraceEndsAt, null);
  assert.equal(userResponse.jsonBody.session.recoveryScope, "account");
  assert.equal(userResponse.jsonBody.user.username, "owner121");

  const guestResponse = createMockResponse();
  await handler(
    {
      method: "GET",
      headers: { "x-session-kind": "guest" }
    },
    guestResponse
  );

  assert.equal(guestResponse.statusCode, 200);
  assert.equal(guestResponse.jsonBody.user, null);
  assert.equal(guestResponse.jsonBody.session.presenceState, "connected");
  assert.equal(guestResponse.jsonBody.session.recoveryEligible, true);
  assert.equal(guestResponse.jsonBody.session.reconnectGraceEndsAt, null);
  assert.equal(guestResponse.jsonBody.session.recoveryScope, "room");
  assert.equal(guestResponse.jsonBody.session.roomNo, "612345");
});

test("room detail handlers expose one aligned recovery contract across card, party, and board rooms", async () => {
  resetLiveRoomState();

  const cardManager = getRoomManager();
  const partyManager = getPartyRoomManager();
  const boardManager = getBoardRoomManager();
  const owner = {
    id: 131,
    username: "owner131",
    displayName: "Owner 131",
    kind: "user"
  };
  const joiner = {
    id: 132,
    username: "joiner132",
    displayName: "Joiner 132",
    kind: "user"
  };
  const partyGuest = {
    id: "guest_party_1",
    username: "guest_party_1",
    displayName: "Guest Party"
  };
  const boardGuest = {
    id: "guest_board_1",
    username: "guest_board_1",
    displayName: "Guest Board"
  };

  const cardRoom = cardManager.createRoom(
    owner,
    {
      id: 3,
      name: "phase7-classic",
      title: "Phase 7 經典桌",
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
  cardManager.joinRoom(cardRoom.roomNo, joiner);
  cardManager.addBot(cardRoom.roomNo, owner.id, 1);

  const partyRoom = partyManager.createRoom(owner, "werewolf", {
    visibility: "private",
    maxPlayers: 8
  });
  partyManager.joinRoom(partyRoom.roomNo, partyGuest);
  partyManager.addBot(partyRoom.roomNo, owner.id, 1);

  const boardRoom = boardManager.createRoom(owner, "gomoku", {
    visibility: "private",
    maxPlayers: 2
  });
  boardManager.joinRoom(boardRoom.roomNo, boardGuest);

  const cardHandler = loadWithMocks("./backend/handlers/rooms/[roomNo]/index.js", {
    "./lib/auth": {
      getSessionFromRequest: async () => owner
    },
    "./lib/admin/control-plane": createAvailabilityControlPlaneMock()
  });
  const partyHandler = loadWithMocks("./backend/handlers/party/rooms/[roomNo]/index.js", {
    "./lib/auth": {
      getSessionFromRequest: async () => ({
        kind: "guest",
        id: partyGuest.id,
        guestId: partyGuest.id,
        displayName: partyGuest.displayName,
        gameKey: "werewolf",
        roomNo: partyRoom.roomNo
      })
    },
    "./lib/admin/control-plane": createAvailabilityControlPlaneMock()
  });
  const boardHandler = loadWithMocks("./backend/handlers/board/rooms/[roomNo]/index.js", {
    "./lib/auth": {
      getSessionFromRequest: async () => ({
        kind: "guest",
        id: boardGuest.id,
        guestId: boardGuest.id,
        displayName: boardGuest.displayName,
        gameKey: "gomoku",
        roomNo: boardRoom.roomNo
      })
    },
    "./lib/admin/control-plane": createAvailabilityControlPlaneMock()
  });

  const cardResponse = createMockResponse();
  const partyResponse = createMockResponse();
  const boardResponse = createMockResponse();

  await cardHandler(
    {
      method: "GET",
      query: { roomNo: cardRoom.roomNo },
      headers: {}
    },
    cardResponse
  );
  await partyHandler(
    {
      method: "GET",
      query: { roomNo: partyRoom.roomNo },
      headers: {}
    },
    partyResponse
  );
  await boardHandler(
    {
      method: "GET",
      query: { roomNo: boardRoom.roomNo },
      headers: {}
    },
    boardResponse
  );

  assert.equal(cardResponse.statusCode, 200);
  assert.equal(partyResponse.statusCode, 200);
  assert.equal(boardResponse.statusCode, 200);

  const expectedHumanRecovery = {
    connected: true,
    presenceState: "connected",
    recoveryEligible: true,
    reconnectGraceEndsAt: null
  };

  assert.deepEqual(
    pickRecoveryFields(cardResponse.jsonBody.room.players.find((player) => player.userId === owner.id)),
    expectedHumanRecovery
  );
  assert.deepEqual(
    pickRecoveryFields(
      partyResponse.jsonBody.room.players.find((player) => player.userId === partyGuest.id)
    ),
    expectedHumanRecovery
  );
  assert.deepEqual(
    pickRecoveryFields(
      boardResponse.jsonBody.room.players.find((player) => player.userId === boardGuest.id)
    ),
    expectedHumanRecovery
  );

  assert.deepEqual(
    pickRecoveryFields(partyResponse.jsonBody.room.viewer),
    expectedHumanRecovery
  );
  assert.deepEqual(
    pickRecoveryFields(boardResponse.jsonBody.room.viewer),
    expectedHumanRecovery
  );
  assert.deepEqual(
    pickRecoveryFields(cardResponse.jsonBody.room.players.find((player) => player.isBot)),
    {
      connected: true,
      presenceState: "connected",
      recoveryEligible: false,
      reconnectGraceEndsAt: null
    }
  );
});

test("snapshot-only discovery and detail flows expose one recovery-aware availability contract", async () => {
  resetLiveRoomState();

  registerRoomEntry({
    roomNo: "410001",
    familyKey: "card",
    gameKey: "doudezhu",
    title: "恢復中的牌桌",
    strapline: "等待 live 房恢復",
    detailRoute: "/room/410001",
    joinRoute: "/api/rooms/410001/join",
    visibility: "public",
    ownerId: 141,
    state: "waiting",
    supportsShareLink: true,
    guestAllowed: false,
    memberIds: [141],
    source: ROOM_DIRECTORY_SNAPSHOT_SOURCES.SNAPSHOT,
    restoredAt: "2026-04-22T13:20:00.000Z"
  });
  registerRoomEntry({
    roomNo: "410002",
    familyKey: "party",
    gameKey: "werewolf",
    title: "恢復中的狼人房",
    strapline: "等待 live 房恢復",
    detailRoute: "/party/410002",
    joinRoute: "/api/party/rooms/410002/join",
    visibility: "private",
    ownerId: 141,
    state: "waiting",
    supportsShareLink: true,
    guestAllowed: true,
    memberIds: [141, "guest_party_snapshot"],
    source: ROOM_DIRECTORY_SNAPSHOT_SOURCES.SNAPSHOT,
    restoredAt: "2026-04-22T13:21:00.000Z"
  });
  registerRoomEntry({
    roomNo: "410003",
    familyKey: "board",
    gameKey: "gomoku",
    title: "恢復中的棋盤房",
    strapline: "等待 live 房恢復",
    detailRoute: "/board/410003",
    joinRoute: "/api/board/rooms/410003/join",
    visibility: "private",
    ownerId: 141,
    state: "waiting",
    supportsShareLink: true,
    guestAllowed: true,
    memberIds: [141],
    source: ROOM_DIRECTORY_SNAPSHOT_SOURCES.SNAPSHOT,
    restoredAt: "2026-04-22T13:22:00.000Z"
  });

  const hubHandler = loadWithMocks("./backend/handlers/hub.js", {
    "./lib/db": {
      query: async (text) => {
        if (String(text).includes("FROM users")) {
          return { rows: [] };
        }

        if (String(text).includes("FROM system_configs")) {
          return { rows: [] };
        }

        return { rows: [] };
      }
    }
  });
  const resolveHandler = loadWithMocks("./backend/handlers/room-entry/resolve.js", {
    "./lib/admin/control-plane": createAvailabilityControlPlaneMock()
  });
  const shareableHandler = loadWithMocks("./backend/handlers/room-entry/shareable.js", {
    "./lib/auth": {
      requireUser: async () => ({ id: 141 })
    }
  });
  const guestHandler = loadWithMocks("./backend/handlers/room-entry/guest.js", {});
  const cardHandler = loadWithMocks("./backend/handlers/rooms/[roomNo]/index.js", {
    "./lib/auth": {
      getSessionFromRequest: async () => null
    },
    "./lib/admin/control-plane": createAvailabilityControlPlaneMock()
  });
  const partyHandler = loadWithMocks("./backend/handlers/party/rooms/[roomNo]/index.js", {
    "./lib/auth": {
      getSessionFromRequest: async () => null
    },
    "./lib/admin/control-plane": createAvailabilityControlPlaneMock()
  });
  const boardHandler = loadWithMocks("./backend/handlers/board/rooms/[roomNo]/index.js", {
    "./lib/auth": {
      getSessionFromRequest: async () => null
    },
    "./lib/admin/control-plane": createAvailabilityControlPlaneMock()
  });

  const hubResponse = createMockResponse();
  await hubHandler({ method: "GET", headers: {} }, hubResponse);
  assert.equal(hubResponse.statusCode, 200);
  const hubSnapshot = hubResponse.jsonBody.liveFeed.find((room) => room.roomNo === "410001");
  assert.ok(hubSnapshot);
  assert.equal(hubSnapshot.availability, "snapshot-only");
  assert.equal(hubSnapshot.entryRoute, "/entry/doudezhu/410001");
  assert.equal(hubSnapshot.degradedState.state, "healthy");
  assert.equal(hubSnapshot.degradedState.subsystems.entry.state, "healthy");

  const resolveResponse = createMockResponse();
  await resolveHandler(
    {
      method: "GET",
      query: { roomNo: "410002", gameKeyHint: "werewolf" },
      headers: {}
    },
    resolveResponse
  );
  assert.equal(resolveResponse.statusCode, 200);
  assert.equal(resolveResponse.jsonBody.availability, "snapshot-only");
  assert.equal(resolveResponse.jsonBody.shareUrl, "/entry/werewolf/410002");
  assert.equal(resolveResponse.jsonBody.degradedState.subsystems.voice.state, "healthy");

  const shareableResponse = createMockResponse();
  await shareableHandler({ method: "GET", headers: {} }, shareableResponse);
  assert.equal(shareableResponse.statusCode, 200);
  const shareableSnapshot = shareableResponse.jsonBody.items.find((item) => item.roomNo === "410002");
  assert.ok(shareableSnapshot);
  assert.equal(shareableSnapshot.availability, "snapshot-only");

  const guestResponse = createMockResponse();
  await guestHandler(
    {
      method: "POST",
      body: {
        roomNo: "410003",
        gameKey: "gomoku",
        displayName: "恢復中遊客"
      },
      headers: {}
    },
    guestResponse
  );
  assert.equal(guestResponse.statusCode, 409);
  assert.deepEqual(guestResponse.jsonBody, {
    error: "房間正在從單機重啟中恢復，暫時不能建立遊客席位。",
    availability: "snapshot-only",
    roomNo: "410003",
    gameKey: "gomoku"
  });

  const cardResponse = createMockResponse();
  await cardHandler(
    {
      method: "GET",
      query: { roomNo: "410001" },
      headers: {}
    },
    cardResponse
  );
  assert.equal(cardResponse.statusCode, 409);
  assert.deepEqual(cardResponse.jsonBody, {
    error: "房間正在從單機重啟中恢復，暫時不能直接進入。",
    availability: "snapshot-only",
    roomNo: "410001",
    gameKey: "doudezhu",
    degradedState: {
      state: "healthy",
      label: "正常",
      familyKey: "card",
      roomAvailability: "snapshot-only",
      subsystems: {
        entry: {
          subsystem: "entry",
          state: "healthy",
          label: "正常",
          reasonCode: "",
          message: "",
          safeActions: [],
          scope: "global",
          familyKey: "",
          configured: false
        },
        realtime: {
          subsystem: "realtime",
          state: "healthy",
          label: "正常",
          reasonCode: "",
          message: "",
          safeActions: [],
          scope: "global",
          familyKey: "",
          configured: false
        },
        voice: {
          subsystem: "voice",
          state: "healthy",
          label: "正常",
          reasonCode: "",
          message: "",
          safeActions: [],
          scope: "global",
          familyKey: "",
          configured: false,
          supported: false
        }
      }
    }
  });

  const partyResponse = createMockResponse();
  await partyHandler(
    {
      method: "GET",
      query: { roomNo: "410002" },
      headers: {}
    },
    partyResponse
  );
  assert.equal(partyResponse.statusCode, 409);
  assert.deepEqual(partyResponse.jsonBody, {
    error: "房間正在從單機重啟中恢復，暫時不能直接進入。",
    availability: "snapshot-only",
    roomNo: "410002",
    gameKey: "werewolf",
    degradedState: {
      state: "healthy",
      label: "正常",
      familyKey: "party",
      roomAvailability: "snapshot-only",
      subsystems: {
        entry: {
          subsystem: "entry",
          state: "healthy",
          label: "正常",
          reasonCode: "",
          message: "",
          safeActions: [],
          scope: "global",
          familyKey: "",
          configured: false
        },
        realtime: {
          subsystem: "realtime",
          state: "healthy",
          label: "正常",
          reasonCode: "",
          message: "",
          safeActions: [],
          scope: "global",
          familyKey: "",
          configured: false
        },
        voice: {
          subsystem: "voice",
          state: "healthy",
          label: "正常",
          reasonCode: "",
          message: "",
          safeActions: [],
          scope: "global",
          familyKey: "",
          configured: false
        }
      }
    }
  });

  const boardResponse = createMockResponse();
  await boardHandler(
    {
      method: "GET",
      query: { roomNo: "410003" },
      headers: {}
    },
    boardResponse
  );
  assert.equal(boardResponse.statusCode, 409);
  assert.deepEqual(boardResponse.jsonBody, {
    error: "房間正在從單機重啟中恢復，暫時不能直接進入。",
    availability: "snapshot-only",
    roomNo: "410003",
    gameKey: "gomoku",
    degradedState: {
      state: "healthy",
      label: "正常",
      familyKey: "board",
      roomAvailability: "snapshot-only",
      subsystems: {
        entry: {
          subsystem: "entry",
          state: "healthy",
          label: "正常",
          reasonCode: "",
          message: "",
          safeActions: [],
          scope: "global",
          familyKey: "",
          configured: false
        },
        realtime: {
          subsystem: "realtime",
          state: "healthy",
          label: "正常",
          reasonCode: "",
          message: "",
          safeActions: [],
          scope: "global",
          familyKey: "",
          configured: false
        },
        voice: {
          subsystem: "voice",
          state: "healthy",
          label: "正常",
          reasonCode: "",
          message: "",
          safeActions: [],
          scope: "global",
          familyKey: "",
          configured: false,
          supported: false
        }
      }
    }
  });

  const missingResponse = createMockResponse();
  await cardHandler(
    {
      method: "GET",
      query: { roomNo: "419999" },
      headers: {}
    },
    missingResponse
  );
  assert.equal(missingResponse.statusCode, 404);
  assert.equal(missingResponse.jsonBody.error, "房間不存在");
});

test("availability controls attach an additive degraded-state envelope without overwriting room availability truth", async () => {
  resetLiveRoomState();

  registerRoomEntry({
    roomNo: "510002",
    familyKey: "party",
    gameKey: "werewolf",
    title: "受控狼人房",
    strapline: "入口受控",
    detailRoute: "/party/510002",
    joinRoute: "/api/party/rooms/510002/join",
    visibility: "private",
    ownerId: 141,
    state: "waiting",
    supportsShareLink: true,
    guestAllowed: true,
    memberIds: [141]
  });

  const resolveHandler = loadWithMocks("./backend/handlers/room-entry/resolve.js", {
    "./lib/db": {
      query: async (_text, params = []) => {
        if (Array.isArray(params[0])) {
          return {
            rows: [
              {
                key: "availabilityControls",
                value: {
                  families: {
                    party: {
                      entry: {
                        state: "blocked",
                        reasonCode: "party-entry-drain",
                        message: "派對房入口維護中，請先保留邀請。",
                        safeActions: ["wait", "share-link"],
                        configured: true
                      },
                      voice: {
                        state: "degraded",
                        reasonCode: "party-voice-unstable",
                        message: "派對語音不穩定，可先文字溝通。",
                        safeActions: ["retry", "continue-text-only"],
                        configured: true
                      }
                    }
                  }
                }
              }
            ]
          };
        }

        return { rows: [] };
      }
    }
  });

  const resolveResponse = createMockResponse();
  await resolveHandler(
    {
      method: "GET",
      query: { roomNo: "510002", gameKeyHint: "werewolf" },
      headers: {}
    },
    resolveResponse
  );

  assert.equal(resolveResponse.statusCode, 200);
  assert.equal(resolveResponse.jsonBody.availability, "live");
  assert.equal(resolveResponse.jsonBody.degradedState.state, "blocked");
  assert.equal(resolveResponse.jsonBody.degradedState.subsystems.entry.state, "blocked");
  assert.equal(resolveResponse.jsonBody.degradedState.subsystems.entry.scope, "family");
  assert.equal(resolveResponse.jsonBody.degradedState.subsystems.entry.familyKey, "party");
  assert.equal(resolveResponse.jsonBody.degradedState.subsystems.voice.state, "degraded");
  assert.deepEqual(resolveResponse.jsonBody.degradedState.subsystems.voice.safeActions, [
    "retry",
    "continue-text-only"
  ]);
});

test("undercover room-entry specializes party voice guidance for turn-based mic flow", async () => {
  resetLiveRoomState();

  registerRoomEntry({
    roomNo: "510003",
    familyKey: "party",
    gameKey: "undercover",
    title: "受控臥底房",
    strapline: "輪流描述",
    detailRoute: "/undercover/510003",
    joinRoute: "/api/party/rooms/510003/join",
    visibility: "private",
    ownerId: 142,
    state: "waiting",
    supportsShareLink: true,
    guestAllowed: true,
    memberIds: [142]
  });

  const resolveHandler = loadWithMocks("./backend/handlers/room-entry/resolve.js", {
    "./lib/db": {
      query: async (_text, params = []) => {
        if (Array.isArray(params[0])) {
          return {
            rows: [
              {
                key: "availabilityControls",
                value: {
                  families: {
                    party: {
                      voice: {
                        state: "degraded",
                        reasonCode: "party-voice-unstable",
                        configured: true
                      }
                    }
                  }
                }
              }
            ]
          };
        }

        return { rows: [] };
      }
    }
  });

  const resolveResponse = createMockResponse();
  await resolveHandler(
    {
      method: "GET",
      query: { roomNo: "510003", gameKeyHint: "undercover" },
      headers: {}
    },
    resolveResponse
  );

  assert.equal(resolveResponse.statusCode, 200);
  assert.equal(resolveResponse.jsonBody.degradedState.subsystems.voice.state, "degraded");
  assert.deepEqual(resolveResponse.jsonBody.degradedState.subsystems.voice.safeActions, [
    "retry",
    "active-speaker-only"
  ]);
  assert.match(resolveResponse.jsonBody.degradedState.subsystems.voice.message, /輪到描述者再開咪/);
});

test("/api/hub returns unified family discovery payload without hiding paused live rooms", async () => {
  resetLiveRoomState();

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

function pickRecoveryFields(value) {
  return {
    connected: value.connected,
    presenceState: value.presenceState,
    recoveryEligible: value.recoveryEligible,
    reconnectGraceEndsAt: value.reconnectGraceEndsAt
  };
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
