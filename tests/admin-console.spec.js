const { test, expect } = require("playwright/test");
const { API_ROUTES, apiUrl } = require("../lib/client/network-runtime");

const FRONTEND_BASE_URL = String(process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3100").replace(/\/+$/, "");

test("admin console exposes grouped family toggles and recent audit traces", async ({ page }) => {
  page.setDefaultTimeout(30000);

  await loginAsAdmin(page);
  await setGameEnabled(page, "doudezhu", true);

  const existingRoomNo = await createCardRoom(page);

  try {
    await page.goto(`${FRONTEND_BASE_URL}/admin`);

    await expect(page.locator('[data-admin-family="card"]')).toBeVisible();
    await expect(page.locator('[data-admin-family="party"]')).toBeVisible();
    await expect(page.locator('[data-admin-family="board"]')).toBeVisible();
    await expect(page.getByText("只影响新房").first()).toBeVisible();

    const doudezhuRow = page.locator('[data-game-key="doudezhu"]');
    await expect(doudezhuRow).toContainText("斗地主");
    await doudezhuRow.getByRole("button", { name: /停用新房/ }).click();

    await expect(page.locator('[data-audit-row]').first()).toContainText(/遊戲開關/);
    await expect(page.locator('[data-audit-row]').first()).toContainText(/doudezhu|斗地主/);
    await expect(page.getByText("新房生效").first()).toBeVisible();

    const createBlockedError = await createCardRoomExpectError(page);
    expect(createBlockedError).toBe("該遊戲目前未開放新房");

    await page.goto(`${FRONTEND_BASE_URL}/room/${existingRoomNo}`);
    await expect(page.getByRole("button", { name: "準備開局" })).toBeVisible();
  } finally {
    await setGameEnabled(page, "doudezhu", true).catch(() => {});
  }
});

async function loginAsAdmin(page) {
  await page.goto(`${FRONTEND_BASE_URL}/login`);
  await page.getByLabel("帳號或郵箱").fill("admin");
  await page.getByLabel("密碼").fill("Admin123456");
  await page.getByRole("button", { name: "登入" }).click();
  await expect(page).toHaveURL(`${FRONTEND_BASE_URL}/`);
}

async function createCardRoom(page) {
  const url = apiUrl(API_ROUTES.cardRooms.create());

  return page.evaluate(async ({ requestUrl }) => {
    const response = await fetch(requestUrl, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        templateId: 1,
        overrides: {
          baseScore: 20,
          countdownSeconds: 12,
          roomVisibility: "private"
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "failed to create room");
    }

    return data.room.roomNo;
  }, { requestUrl: url });
}

async function createCardRoomExpectError(page) {
  const url = apiUrl(API_ROUTES.cardRooms.create());

  return page.evaluate(async ({ requestUrl }) => {
    const response = await fetch(requestUrl, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        templateId: 1,
        overrides: {
          baseScore: 20,
          countdownSeconds: 12,
          roomVisibility: "private"
        }
      })
    });

    const data = await response.json();
    return data.error || "";
  }, { requestUrl: url });
}

async function setGameEnabled(page, gameKey, enabled) {
  const url = apiUrl(API_ROUTES.admin.capabilities());

  return page.evaluate(
    async ({ requestUrl, targetGameKey, nextEnabled }) => {
      const response = await fetch(requestUrl, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          updates: [
            {
              gameKey: targetGameKey,
              enabled: nextEnabled,
              reason: "playwright-admin-console"
            }
          ]
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "failed to update capability");
      }

      return data;
    },
    {
      requestUrl: url,
      targetGameKey: gameKey,
      nextEnabled: enabled
    }
  );
}
