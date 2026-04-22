const { test, expect } = require("playwright/test");
const { API_ROUTES, apiUrl } = require("../lib/client/network-runtime");

const FRONTEND_BASE_URL = String(process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3100").replace(/\/+$/, "");

test("homepage hub shows family arcade states", async ({ page }) => {
  page.setDefaultTimeout(30000);

  await loginAsAdmin(page);

  try {
    await setGameEnabled(page, "doudezhu", false);

    await page.goto(`${FRONTEND_BASE_URL}/`);
    await expect(page.getByRole("heading", { name: "遊戲入口", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "遊戲家族", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "推箱子", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "黑白棋", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "誰是臥底", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "UNO 類", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "你畫我猜", exact: true })).toBeVisible();
    await expect(page.getByText("直接開始，不需房號")).toBeVisible();
    await expect(page.getByRole("link", { name: "立即遊玩" }).first()).toBeVisible();
    await expect(page.getByText("暫停新房").first()).toBeVisible();
    await expect(page.getByText("即將推出").first()).toBeVisible();
    await expect(page.getByText("目前不開新房，已有房號或邀請可直接加入。").first()).toBeVisible();
  } finally {
    await setGameEnabled(page, "doudezhu", true).catch(() => {});
  }
});

test("logged-out invite deep link can enter eligible room as guest", async ({ page }) => {
  page.setDefaultTimeout(30000);

  await loginAsAdmin(page);
  const roomNo = await createPrivatePartyRoom(page, "werewolf");

  await page.context().clearCookies();
  await page.goto(`${FRONTEND_BASE_URL}/entry/werewolf/${roomNo}`);

  await expect(page.getByRole("button", { name: "以遊客進入" })).toBeVisible();
  await expect(page.getByRole("button", { name: "登入後進入" })).toBeVisible();
  await expect(page.getByRole("link", { name: "先回遊戲家族" })).toBeVisible();

  await page.getByRole("button", { name: "以遊客進入" }).click();
  await expect(page).toHaveURL(new RegExp(`/party/${roomNo}$`));
  await expect(page.getByText(`房号 ${roomNo}`)).toBeVisible();
});

async function loginAsAdmin(page) {
  await page.goto(`${FRONTEND_BASE_URL}/login`);
  await page.getByLabel("帳號或郵箱").fill("admin");
  await page.getByLabel("密碼").fill("Admin123456");
  await page.getByRole("button", { name: "登入" }).click();
  await expect(page).toHaveURL(`${FRONTEND_BASE_URL}/`);
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
              reason: "playwright-hub-entry"
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

async function createPrivatePartyRoom(page, gameKey) {
  const url = apiUrl(API_ROUTES.partyRooms.create(gameKey));

  return page.evaluate(
    async ({ requestUrl, targetGameKey }) => {
      const response = await fetch(requestUrl, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          gameKey: targetGameKey,
          config: {
            visibility: "private",
            maxPlayers: 6,
            nightSeconds: 45,
            discussionSeconds: 70,
            voteSeconds: 35,
            voiceEnabled: true
          }
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "failed to create party room");
      }

      return data.room.roomNo;
    },
    {
      requestUrl: url,
      targetGameKey: gameKey
    }
  );
}
