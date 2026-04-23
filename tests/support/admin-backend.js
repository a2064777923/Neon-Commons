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
  const timeout = Number.isFinite(options.timeout) ? options.timeout : 20000;
  const attempts = Number.isFinite(options.attempts) ? Math.max(1, options.attempts) : 2;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: options.method || "GET",
        headers: {
          cookie: getAdminSessionCookie(),
          connection: "close",
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
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isRetryableFetchError(error)) {
        throw error;
      }

      await wait(250 * attempt);
    }
  }
}

module.exports = {
  adminBackendJson
};

function isRetryableFetchError(error) {
  if (!error) {
    return false;
  }

  return (
    error.name === "TimeoutError" ||
    error.name === "AbortError" ||
    /fetch failed|socket|timed out|terminated|reset/i.test(String(error.message || ""))
  );
}

function wait(durationMs) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}
