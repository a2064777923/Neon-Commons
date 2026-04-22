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
