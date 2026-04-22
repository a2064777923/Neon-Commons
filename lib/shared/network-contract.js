const AUTH_SCOPES = Object.freeze({
  PUBLIC: "public",
  USER: "user",
  ADMIN: "admin"
});

const API_ROUTE_PATTERNS = Object.freeze({
  auth: Object.freeze({
    login: "/api/auth/login",
    logout: "/api/auth/logout",
    register: "/api/auth/register"
  }),
  hub: "/api/hub",
  me: "/api/me",
  profile: "/api/profile",
  leaderboard: "/api/leaderboard",
  templates: "/api/templates",
  cardRooms: Object.freeze({
    list: "/api/rooms",
    detail: "/api/rooms/:roomNo",
    join: "/api/rooms/:roomNo/join"
  }),
  partyRooms: Object.freeze({
    list: "/api/party/rooms",
    detail: "/api/party/rooms/:roomNo",
    join: "/api/party/rooms/:roomNo/join"
  }),
  boardRooms: Object.freeze({
    list: "/api/board/rooms",
    detail: "/api/board/rooms/:roomNo",
    join: "/api/board/rooms/:roomNo/join"
  }),
  roomEntry: Object.freeze({
    resolve: "/api/room-entry/resolve",
    shareable: "/api/room-entry/shareable",
    guest: "/api/room-entry/guest",
    guestSync: "/api/room-entry/guest-sync"
  }),
  admin: Object.freeze({
    players: "/api/admin/players",
    playerAdjust: "/api/admin/players/:id/adjust",
    templates: "/api/admin/templates",
    config: "/api/admin/config",
    capabilities: "/api/admin/capabilities",
    runtime: "/api/admin/runtime",
    logs: "/api/admin/logs"
  })
});

function buildPath(pattern, params = {}, query = {}) {
  const path = pattern.replace(/:([A-Za-z0-9_]+)/g, (_match, name) => {
    if (!(name in params)) {
      throw new Error(`Missing route param: ${name}`);
    }

    return encodeURIComponent(String(params[name]));
  });

  const entries = Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== "");
  if (entries.length === 0) {
    return path;
  }

  const search = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");

  return `${path}?${search}`;
}

function createHandlerContract(id, path, methods, auth) {
  const normalizedMethods = [...methods].map((method) => String(method).toUpperCase());
  const normalizedAuth = normalizeAuth(normalizedMethods, auth);

  return Object.freeze({
    id,
    path,
    methods: Object.freeze(normalizedMethods),
    auth: normalizedAuth
  });
}

function normalizeAuth(methods, auth) {
  if (typeof auth === "string") {
    return Object.freeze(
      Object.fromEntries(methods.map((method) => [method, auth]))
    );
  }

  return Object.freeze(
    Object.fromEntries(
      methods.map((method) => [
        method,
        auth?.[method] || auth?.[method.toLowerCase()] || auth?.all || null
      ])
    )
  );
}

function getContractAuthScope(contract, method) {
  if (!contract || !contract.auth) {
    return null;
  }

  return contract.auth[String(method || "").toUpperCase()] || null;
}

const API_ROUTES = Object.freeze({
  auth: Object.freeze({
    login: () => API_ROUTE_PATTERNS.auth.login,
    logout: () => API_ROUTE_PATTERNS.auth.logout,
    register: () => API_ROUTE_PATTERNS.auth.register
  }),
  hub: () => API_ROUTE_PATTERNS.hub,
  me: () => API_ROUTE_PATTERNS.me,
  profile: () => API_ROUTE_PATTERNS.profile,
  leaderboard: () => API_ROUTE_PATTERNS.leaderboard,
  templates: () => API_ROUTE_PATTERNS.templates,
  cardRooms: Object.freeze({
    list: () => API_ROUTE_PATTERNS.cardRooms.list,
    create: () => API_ROUTE_PATTERNS.cardRooms.list,
    detail: (roomNo) => buildPath(API_ROUTE_PATTERNS.cardRooms.detail, { roomNo }),
    join: (roomNo) => buildPath(API_ROUTE_PATTERNS.cardRooms.join, { roomNo })
  }),
  partyRooms: Object.freeze({
    list: (gameKey) => buildPath(API_ROUTE_PATTERNS.partyRooms.list, {}, gameKey ? { gameKey } : {}),
    create: (gameKey) => buildPath(API_ROUTE_PATTERNS.partyRooms.list, {}, gameKey ? { gameKey } : {}),
    detail: (roomNo) => buildPath(API_ROUTE_PATTERNS.partyRooms.detail, { roomNo }),
    join: (roomNo) => buildPath(API_ROUTE_PATTERNS.partyRooms.join, { roomNo })
  }),
  boardRooms: Object.freeze({
    list: (gameKey) => buildPath(API_ROUTE_PATTERNS.boardRooms.list, {}, gameKey ? { gameKey } : {}),
    create: (gameKey) => buildPath(API_ROUTE_PATTERNS.boardRooms.list, {}, gameKey ? { gameKey } : {}),
    detail: (roomNo) => buildPath(API_ROUTE_PATTERNS.boardRooms.detail, { roomNo }),
    join: (roomNo) => buildPath(API_ROUTE_PATTERNS.boardRooms.join, { roomNo })
  }),
  roomEntry: Object.freeze({
    resolve: (roomNo, gameKeyHint) =>
      buildPath(API_ROUTE_PATTERNS.roomEntry.resolve, {}, {
        roomNo,
        ...(gameKeyHint ? { gameKeyHint } : {})
      }),
    shareable: () => API_ROUTE_PATTERNS.roomEntry.shareable,
    guest: () => API_ROUTE_PATTERNS.roomEntry.guest,
    guestSync: () => API_ROUTE_PATTERNS.roomEntry.guestSync
  }),
  admin: Object.freeze({
    players: () => API_ROUTE_PATTERNS.admin.players,
    playerAdjust: (id) => buildPath(API_ROUTE_PATTERNS.admin.playerAdjust, { id }),
    templates: () => API_ROUTE_PATTERNS.admin.templates,
    config: () => API_ROUTE_PATTERNS.admin.config,
    capabilities: () => API_ROUTE_PATTERNS.admin.capabilities,
    runtime: () => API_ROUTE_PATTERNS.admin.runtime,
    logs: () => API_ROUTE_PATTERNS.admin.logs
  })
});

const SOCKET_EVENTS = Object.freeze({
  room: Object.freeze({
    subscribe: "room:subscribe",
    ready: "room:ready",
    addBot: "room:add-bot",
    bid: "game:bid",
    play: "game:play",
    pass: "game:pass",
    trustee: "game:trustee",
    chat: "room:chat",
    update: "room:update",
    error: "room:error"
  }),
  party: Object.freeze({
    subscribe: "party:subscribe",
    ready: "party:ready",
    addBot: "party:add-bot",
    message: "party:message",
    action: "party:action",
    update: "party:update",
    error: "party:error",
    voicePeers: "voice:peers",
    voiceUserJoined: "voice:user-joined",
    voiceUserLeft: "voice:user-left"
  }),
  board: Object.freeze({
    subscribe: "board:subscribe",
    ready: "board:ready",
    addBot: "board:add-bot",
    move: "board:move",
    update: "board:update",
    error: "board:error"
  }),
  voice: Object.freeze({
    join: "voice:join",
    leave: "voice:leave",
    state: "voice:state",
    signal: "voice:signal"
  })
});

module.exports = {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  API_ROUTES,
  SOCKET_EVENTS,
  buildPath,
  createHandlerContract,
  getContractAuthScope
};
