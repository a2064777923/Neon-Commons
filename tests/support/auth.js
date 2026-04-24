const { COOKIE_NAME } = require("../../lib/auth");
const SESSION_REGISTER_TIMEOUT_MS = 20000;
const SESSION_REGISTER_ATTEMPTS = 2;

function createFreshCredentials(prefix = "smoke") {
  const uniqueId = `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 6)}`.toLowerCase();
  return {
    username: uniqueId,
    displayName: uniqueId.slice(0, 24),
    email: `${uniqueId}@example.test`,
    password: "Smoke123456"
  };
}

async function registerFreshUser(page, baseUrl, prefix = "smoke") {
  const credentials = createFreshCredentials(prefix);
  return registerFreshUserWithCredentials(page, baseUrl, credentials);
}

async function registerFreshUserWithCredentials(page, baseUrl, credentials) {
  await page.goto(`${baseUrl}/register`);
  await page.getByLabel("用戶名").fill(credentials.username);
  await page.getByLabel("顯示名稱").fill(credentials.displayName);
  await page.getByLabel("郵箱").fill(credentials.email);
  await page.getByLabel("密碼").fill(credentials.password);
  const registerResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/register") && response.request().method() === "POST",
    {
      timeout: 30000
    }
  );
  await page.getByRole("button", { name: "創建帳號" }).click();

  try {
    const registerResponse = await registerResponsePromise;
    if (!registerResponse.ok()) {
      const payload = await registerResponse.json().catch(() => ({}));
      throw new Error(payload.error || "registration request failed");
    }

    await page.waitForURL(`${baseUrl}/`, {
      timeout: 30000,
      waitUntil: "commit"
    });
  } catch (error) {
    const errorText = await page
      .locator(".error-text")
      .first()
      .textContent()
      .catch(() => "");

    if (errorText) {
      throw new Error(`registration failed: ${errorText}`);
    }

    throw error;
  }

  return credentials;
}

async function loginWithCredentials(page, baseUrl, credentials) {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel("帳號或郵箱").fill(credentials.username);
  await page.getByLabel("密碼").fill(credentials.password);
  const loginResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/login") && response.request().method() === "POST",
    {
      timeout: 30000
    }
  );
  await page.getByRole("button", { name: "登入" }).click();

  try {
    const loginResponse = await loginResponsePromise;
    const data = await loginResponse.json().catch(() => ({}));
    if (!loginResponse.ok()) {
      throw new Error(data.error || "login request failed");
    }

    await page.waitForURL(`${baseUrl}/`, {
      timeout: 30000,
      waitUntil: "commit"
    });
  } catch (error) {
    const errorText = await page
      .locator(".error-text")
      .first()
      .textContent()
      .catch(() => "");

    if (errorText) {
      throw new Error(`login failed: ${errorText}`);
    }

    throw error;
  }

  return credentials;
}

async function registerFreshUserSession(page, baseUrl, prefix = "smoke") {
  const credentials = createFreshCredentials(prefix);
  return registerFreshUserSessionWithCredentials(page, baseUrl, credentials);
}

async function registerFreshUserSessionWithCredentials(page, baseUrl, credentials) {
  const backendBaseUrl = String(baseUrl || "").replace(/:3100$/, ":3101");
  let response;

  try {
    response = await requestSession(`${backendBaseUrl}/api/auth/register`, credentials);
  } catch (error) {
    if (isRetryableFetchError(error)) {
      return recoverFreshUserSession(page, baseUrl, credentials);
    }

    throw error;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (isDuplicateRegistrationError(data.error)) {
      return loginFreshUserSession(page, baseUrl, credentials);
    }
    throw new Error(data.error || "registration request failed");
  }

  await applySessionCookie(page, baseUrl, response);
  await page.goto(`${baseUrl}/`);
  return credentials;
}

module.exports = {
  registerFreshUser,
  registerFreshUserSession
};

async function loginFreshUserSession(page, baseUrl, credentials) {
  const backendBaseUrl = String(baseUrl || "").replace(/:3100$/, ":3101");
  const response = await requestSession(`${backendBaseUrl}/api/auth/login`, {
    account: credentials.username,
    password: credentials.password
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "login request failed");
  }

  await applySessionCookie(page, baseUrl, response);
  await page.goto(`${baseUrl}/`);
  return credentials;
}

async function requestSession(url, payload) {
  let lastError = null;

  for (let attempt = 1; attempt <= SESSION_REGISTER_ATTEMPTS; attempt += 1) {
    try {
      return await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          connection: "close"
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(SESSION_REGISTER_TIMEOUT_MS)
      });
    } catch (error) {
      lastError = error;
      if (attempt >= SESSION_REGISTER_ATTEMPTS || !isRetryableFetchError(error)) {
        throw error;
      }

      await wait(250 * attempt);
    }
  }

  throw lastError;
}

async function recoverFreshUserSession(page, baseUrl, credentials) {
  try {
    return await loginFreshUserSession(page, baseUrl, credentials);
  } catch {}

  try {
    return await registerFreshUserSessionWithCredentials(page, baseUrl, credentials);
  } catch {}

  try {
    return await loginWithCredentials(page, baseUrl, credentials);
  } catch {
    return registerFreshUserWithCredentials(page, baseUrl, credentials);
  }
}

async function applySessionCookie(page, baseUrl, response) {
  const setCookieHeader = response.headers.get("set-cookie") || "";
  const cookieMatch = setCookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!cookieMatch) {
    throw new Error("auth cookie missing");
  }

  await page.context().addCookies([
    {
      name: COOKIE_NAME,
      value: cookieMatch[1],
      url: `${String(baseUrl || "").replace(/\/+$/, "")}/`,
      httpOnly: true,
      sameSite: "Lax"
    }
  ]);
}

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

function isDuplicateRegistrationError(errorMessage) {
  return /duplicate key value|already exists|已存在/i.test(String(errorMessage || ""));
}

function wait(durationMs) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}
