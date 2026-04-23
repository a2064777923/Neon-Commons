const { COOKIE_NAME } = require("../../lib/auth");

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

async function registerFreshUserSession(page, baseUrl, prefix = "smoke") {
  const credentials = createFreshCredentials(prefix);
  const backendBaseUrl = String(baseUrl || "").replace(/:3100$/, ":3101");
  const response = await fetch(`${backendBaseUrl}/api/auth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(credentials),
    signal: AbortSignal.timeout(30000)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "registration request failed");
  }

  const setCookieHeader = response.headers.get("set-cookie") || "";
  const cookieMatch = setCookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!cookieMatch) {
    throw new Error("registration cookie missing");
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

  await page.goto(`${baseUrl}/`);
  return credentials;
}

module.exports = {
  registerFreshUser,
  registerFreshUserSession
};
