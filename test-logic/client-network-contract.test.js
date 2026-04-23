const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PRESENCE_STATES,
  RECOVERY_SCOPES,
  buildSeatRecoveryState,
  buildSessionRecoveryState
} = require("../lib/shared/network-contract");
const {
  API_ROUTES,
  DEFAULT_BACKEND_ORIGIN,
  apiUrl,
  getApiBaseUrl,
  getSocketUrl,
  isLocalFrontendOrigin
} = require("../lib/client/network-runtime");

const PUBLIC_ENV_KEYS = [
  "NEXT_PUBLIC_API_BASE_URL",
  "NEXT_PUBLIC_BACKEND_URL",
  "NEXT_PUBLIC_SOCKET_URL"
];

function makeWindow(origin) {
  return {
    location: {
      origin
    }
  };
}

function withPublicEnv(overrides, fn) {
  const snapshot = Object.fromEntries(PUBLIC_ENV_KEYS.map((key) => [key, process.env[key]]));

  for (const key of PUBLIC_ENV_KEYS) {
    const nextValue = overrides[key];
    if (nextValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = nextValue;
    }
  }

  try {
    return fn();
  } finally {
    for (const key of PUBLIC_ENV_KEYS) {
      if (snapshot[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = snapshot[key];
      }
    }
  }
}

test("API origin prefers NEXT_PUBLIC_API_BASE_URL when provided", () => {
  withPublicEnv(
    {
      NEXT_PUBLIC_API_BASE_URL: "https://api.neon-commons.test/",
      NEXT_PUBLIC_BACKEND_URL: "",
      NEXT_PUBLIC_SOCKET_URL: ""
    },
    () => {
      assert.equal(
        getApiBaseUrl(makeWindow("https://app.neon-commons.test")),
        "https://api.neon-commons.test"
      );
    }
  );
});

test("API origin falls back to NEXT_PUBLIC_BACKEND_URL alias", () => {
  withPublicEnv(
    {
      NEXT_PUBLIC_API_BASE_URL: "",
      NEXT_PUBLIC_BACKEND_URL: "https://legacy-api.neon-commons.test/",
      NEXT_PUBLIC_SOCKET_URL: ""
    },
    () => {
      assert.equal(
        getApiBaseUrl(makeWindow("https://app.neon-commons.test")),
        "https://legacy-api.neon-commons.test"
      );
    }
  );
});

test("API origin stays same-origin for proxied local and deployed browser runtimes", () => {
  withPublicEnv({}, () => {
    assert.equal(
      getApiBaseUrl(makeWindow("http://127.0.0.1:3100")),
      "http://127.0.0.1:3100"
    );
    assert.equal(
      getApiBaseUrl(makeWindow("http://localhost:3100")),
      "http://localhost:3100"
    );
    assert.equal(
      getApiBaseUrl(makeWindow("http://192.168.4.11:3100")),
      "http://192.168.4.11:3100"
    );
    assert.equal(
      getApiBaseUrl(makeWindow("https://play.neon-commons.test")),
      "https://play.neon-commons.test"
    );
  });
});

test("API origin falls back to the default backend origin without browser context", () => {
  withPublicEnv({}, () => {
    assert.equal(getApiBaseUrl(), DEFAULT_BACKEND_ORIGIN);
    assert.equal(apiUrl(API_ROUTES.me()), `${DEFAULT_BACKEND_ORIGIN}${API_ROUTES.me()}`);
  });
});

test("Socket origin prefers NEXT_PUBLIC_SOCKET_URL and otherwise follows API origin resolution", () => {
  withPublicEnv(
    {
      NEXT_PUBLIC_API_BASE_URL: "",
      NEXT_PUBLIC_BACKEND_URL: "",
      NEXT_PUBLIC_SOCKET_URL: "https://socket.neon-commons.test/"
    },
    () => {
      assert.equal(
        getSocketUrl(makeWindow("https://play.neon-commons.test")),
        "https://socket.neon-commons.test"
      );
    }
  );

  withPublicEnv({}, () => {
    assert.equal(
      getSocketUrl(makeWindow("http://127.0.0.1:3100")),
      "http://127.0.0.1:3101"
    );
    assert.equal(
      getSocketUrl(makeWindow("https://play.neon-commons.test")),
      "https://play.neon-commons.test"
    );
  });
});

test("route builders cover representative auth, room, board, and admin endpoints", () => {
  assert.equal(API_ROUTES.auth.login(), "/api/auth/login");
  assert.equal(API_ROUTES.me(), "/api/me");
  assert.equal(API_ROUTES.cardRooms.detail("830512"), "/api/rooms/830512");
  assert.equal(API_ROUTES.boardRooms.join("B-204"), "/api/board/rooms/B-204/join");
  assert.equal(API_ROUTES.admin.config(), "/api/admin/config");
  assert.equal(API_ROUTES.admin.liveRooms.detail("830512"), "/api/admin/live-rooms/830512");
});

test("frontend origin detection matches any split-port frontend host", () => {
  assert.equal(isLocalFrontendOrigin("http://127.0.0.1:3100"), true);
  assert.equal(isLocalFrontendOrigin("http://localhost:3100"), true);
  assert.equal(isLocalFrontendOrigin("http://192.168.4.11:3100"), true);
  assert.equal(isLocalFrontendOrigin("http://127.0.0.1:3101"), false);
  assert.equal(isLocalFrontendOrigin("https://play.neon-commons.test"), false);
});

test("shared recovery contract distinguishes connected, reconnecting, and disconnected seats", () => {
  const reconnectGraceEndsAt = new Date("2026-04-22T03:15:00.000Z").toISOString();

  assert.deepEqual(buildSeatRecoveryState({ connected: true, isBot: false }), {
    connected: true,
    presenceState: PRESENCE_STATES.CONNECTED,
    recoveryEligible: true,
    reconnectGraceEndsAt: null
  });

  assert.deepEqual(
    buildSeatRecoveryState(
      {
        connected: false,
        isBot: false,
        reconnectGraceEndsAt
      },
      { now: Date.parse("2026-04-22T03:10:00.000Z") }
    ),
    {
      connected: false,
      presenceState: PRESENCE_STATES.RECONNECTING,
      recoveryEligible: true,
      reconnectGraceEndsAt
    }
  );

  assert.deepEqual(
    buildSeatRecoveryState(
      {
        connected: false,
        isBot: true,
        reconnectGraceEndsAt
      },
      { now: Date.parse("2026-04-22T03:20:00.000Z") }
    ),
    {
      connected: false,
      presenceState: PRESENCE_STATES.DISCONNECTED,
      recoveryEligible: false,
      reconnectGraceEndsAt
    }
  );
});

test("shared recovery contract exposes account and room scopes for session payloads", () => {
  assert.deepEqual(
    buildSessionRecoveryState({
      kind: "user",
      id: 7,
      username: "hong"
    }),
    {
      presenceState: PRESENCE_STATES.CONNECTED,
      recoveryEligible: true,
      reconnectGraceEndsAt: null,
      recoveryScope: RECOVERY_SCOPES.ACCOUNT
    }
  );

  assert.deepEqual(
    buildSessionRecoveryState({
      kind: "guest",
      id: "guest_1",
      gameKey: "werewolf",
      roomNo: "312456"
    }),
    {
      presenceState: PRESENCE_STATES.CONNECTED,
      recoveryEligible: true,
      reconnectGraceEndsAt: null,
      recoveryScope: RECOVERY_SCOPES.ROOM
    }
  );
});
