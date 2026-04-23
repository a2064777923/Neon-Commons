const { getAdminSessionCookie } = require("./admin-auth");

function parseJsonOrNull(rawText) {
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

async function adminBackendJson(url, options = {}) {
  const timeout = Number.isFinite(options.timeout) ? options.timeout : 15000;
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      cookie: getAdminSessionCookie(),
      ...(options.data === undefined ? {} : { "content-type": "application/json" }),
      ...(options.headers || {})
    },
    body: options.data === undefined ? undefined : JSON.stringify(options.data),
    signal: AbortSignal.timeout(timeout)
  });

  const rawText = await response.text();
  const data = parseJsonOrNull(rawText);
  if (!response.ok) {
    throw new Error(data?.error || `request failed with ${response.status}`);
  }

  return data;
}

module.exports = {
  adminBackendJson
};
