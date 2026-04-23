const fs = require("fs");
const path = require("path");

function createRouter(handlersDir) {
  const routes = loadRoutes(handlersDir);

  async function handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
    const pathname = normalizePathname(url.pathname);

    if (pathname === "/socket.io" || pathname.startsWith("/socket.io/")) {
      return undefined;
    }

    if (req.method === "OPTIONS") {
      return sendNoContent(res);
    }

    const route = matchRoute(routes, pathname);
    if (!route) {
      return sendJson(res, 404, { error: "接口不存在" });
    }

    let body;
    try {
      body = await parseBody(req);
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "请求体格式无效" });
    }

    req.query = {
      ...Object.fromEntries(url.searchParams.entries()),
      ...route.params
    };
    req.params = route.params;
    req.body = body;

    decorateResponse(res);

    try {
      await route.handler(req, res);
      if (!res.writableEnded) {
        res.end();
      }
    } catch (error) {
      if (!res.writableEnded) {
        sendJson(res, 500, { error: error.message || "服务器错误" });
      }
    }

    return undefined;
  }

  return { routes, handleRequest };
}

function loadRoutes(handlersDir) {
  const files = listFiles(handlersDir);
  return files
    .map((filePath) => {
      const routePath = filePathToRoute(handlersDir, filePath);
      const { regex, params } = compileRoute(routePath);
      const loaded = require(filePath);
      const handler = loaded.default || loaded;
      const contract = loaded.contract || handler.contract || null;

      return {
        filePath,
        routePath,
        regex,
        params,
        handler,
        contract
      };
    })
    .sort((left, right) => compareRoutes(left.routePath, right.routePath));
}

function listFiles(dir) {
  const entries = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      entries.push(...listFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".js")) {
      entries.push(entryPath);
    }
  }

  return entries;
}

function filePathToRoute(rootDir, filePath) {
  const relative = path.relative(rootDir, filePath);
  const parts = relative.split(path.sep);
  const fileName = parts.pop().replace(/\.js$/, "");

  if (fileName !== "index") {
    parts.push(fileName);
  }

  const routeParts = parts
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^\[(.+)\]$/);
      return match ? `:${match[1]}` : part;
    });

  return `/api${routeParts.length > 0 ? `/${routeParts.join("/")}` : ""}`;
}

function compileRoute(routePath) {
  const params = [];
  const regexPath = routePath
    .split("/")
    .map((segment) => {
      if (segment.startsWith(":")) {
        params.push(segment.slice(1));
        return "([^/]+)";
      }
      return escapeRegex(segment);
    })
    .join("/");

  return {
    regex: new RegExp(`^${regexPath}/?$`),
    params
  };
}

function matchRoute(routes, pathname) {
  for (const route of routes) {
    const match = pathname.match(route.regex);
    if (!match) {
      continue;
    }

    const params = {};
    route.params.forEach((name, index) => {
      params[name] = decodeURIComponent(match[index + 1]);
    });

    return { handler: route.handler, params };
  }

  return null;
}

function compareRoutes(left, right) {
  const leftScore = routeScore(left);
  const rightScore = routeScore(right);

  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }

  return right.length - left.length;
}

function routeScore(routePath) {
  return routePath
    .split("/")
    .filter(Boolean)
    .reduce((score, segment) => score + (segment.startsWith(":") ? 0 : 2), 0);
}

function decorateResponse(res) {
  if (res.status) {
    return res;
  }

  res.status = (code) => {
    res.statusCode = code;
    return res;
  };

  res.json = (payload) => {
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    res.end(JSON.stringify(payload));
    return res;
  };

  return res;
}

async function parseBody(req) {
  if (req.method === "GET" || req.method === "HEAD") {
    return {};
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error("请求体格式无效");
  }
}

function sendJson(res, statusCode, payload) {
  decorateResponse(res);
  res.status(statusCode).json(payload);
}

function sendNoContent(res) {
  res.statusCode = 204;
  res.end();
}

function normalizePathname(pathname) {
  if (pathname.length > 1) {
    return pathname.replace(/\/+$/, "");
  }

  return pathname;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  createRouter
};
