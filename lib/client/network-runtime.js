const { API_ROUTES, SOCKET_EVENTS } = require("../shared/network-contract");

const DEFAULT_BACKEND_ORIGIN = "http://127.0.0.1:3101";
const LOCAL_FRONTEND_PORT = "3100";
const LOCAL_BACKEND_PORT = "3101";

function getRuntimeWindow(runtimeWindow) {
  if (runtimeWindow) {
    return runtimeWindow;
  }

  if (typeof window !== "undefined") {
    return window;
  }

  return null;
}

function trimTrailingSlash(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function getCurrentOrigin(runtimeWindow) {
  return trimTrailingSlash(getRuntimeWindow(runtimeWindow)?.location?.origin || "");
}

function parseOrigin(origin) {
  try {
    return new URL(origin);
  } catch {
    return null;
  }
}

function isLocalFrontendOrigin(origin) {
  const parsed = parseOrigin(origin);
  if (!parsed) {
    return false;
  }

  return parsed.port === LOCAL_FRONTEND_PORT;
}

function getLocalBackendOrigin(origin) {
  const parsed = parseOrigin(origin);
  if (!parsed || !isLocalFrontendOrigin(origin)) {
    return "";
  }

  parsed.port = LOCAL_BACKEND_PORT;
  return trimTrailingSlash(parsed.toString());
}

function getConfiguredApiOrigin() {
  return (
    trimTrailingSlash(process.env.NEXT_PUBLIC_API_BASE_URL) ||
    trimTrailingSlash(process.env.NEXT_PUBLIC_BACKEND_URL)
  );
}

function getApiBaseUrl(runtimeWindow) {
  const configured = getConfiguredApiOrigin();
  if (configured) {
    return configured;
  }

  const currentOrigin = getCurrentOrigin(runtimeWindow);
  if (currentOrigin) {
    return isLocalFrontendOrigin(currentOrigin)
      ? getLocalBackendOrigin(currentOrigin) || DEFAULT_BACKEND_ORIGIN
      : currentOrigin;
  }

  return DEFAULT_BACKEND_ORIGIN;
}

function getSocketUrl(runtimeWindow) {
  const configuredSocketOrigin = trimTrailingSlash(process.env.NEXT_PUBLIC_SOCKET_URL);
  if (configuredSocketOrigin) {
    return configuredSocketOrigin;
  }

  return getApiBaseUrl(runtimeWindow);
}

function joinUrl(baseUrl, path) {
  const normalizedBase = trimTrailingSlash(baseUrl);
  const suffix = String(path || "").startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${suffix}`;
}

function apiUrl(path, runtimeWindow) {
  return joinUrl(getApiBaseUrl(runtimeWindow), path);
}

async function apiFetch(path, options = {}, runtimeWindow) {
  return fetch(apiUrl(path, runtimeWindow), {
    credentials: "include",
    ...options
  });
}

async function apiFetchJson(path, options = {}, runtimeWindow) {
  const response = await apiFetch(path, options, runtimeWindow);
  const data = await response.json();

  return {
    response,
    data
  };
}

module.exports = {
  API_ROUTES,
  DEFAULT_BACKEND_ORIGIN,
  LOCAL_BACKEND_PORT,
  LOCAL_FRONTEND_PORT,
  SOCKET_EVENTS,
  apiFetch,
  apiFetchJson,
  apiUrl,
  getApiBaseUrl,
  getSocketUrl,
  isLocalFrontendOrigin
};
