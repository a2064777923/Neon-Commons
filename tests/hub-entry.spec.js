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
  const originalMaxOpenRooms = getRuntimeValue(await getAdminRuntime(page), "maxOpenRoomsPerUser", 3);
  await updateRuntimeControl(page, "maxOpenRoomsPerUser", 10);

  try {
    const roomNo = await createPrivatePartyRoom(page, "werewolf");

    await page.context().clearCookies();
    await page.goto(`${FRONTEND_BASE_URL}/entry/werewolf/${roomNo}`);

    await expect(page.getByRole("button", { name: "以遊客進入" })).toBeVisible();
    await expect(page.getByRole("button", { name: "登入後進入" })).toBeVisible();
    await expect(page.getByRole("link", { name: "先回遊戲家族" })).toBeVisible();

    await page.getByRole("button", { name: "以遊客進入" }).click();
    await expect(page).toHaveURL(new RegExp(`/party/${roomNo}$`));
    await expect(page.getByText(`房号 ${roomNo}`)).toBeVisible();
  } finally {
    await loginAsAdmin(page).catch(() => {});
    await updateRuntimeControl(page, "maxOpenRoomsPerUser", originalMaxOpenRooms).catch(() => {});
  }
});

test("hub live feed and entry gate expose stable recovery hooks for snapshot-only rooms", async ({
  page
}) => {
  page.setDefaultTimeout(30000);

  await page.route("**/api/hub", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        families: [],
        liveFeed: [
          {
            roomNo: "812345",
            familyKey: "party",
            gameKey: "werewolf",
            title: "狼人殺",
            strapline: "推理局",
            roomState: "waiting",
            visibility: "private",
            playerCount: 4,
            availability: "snapshot-only",
            detailRoute: "/party/812345",
            entryRoute: "/entry/werewolf/812345",
            sharePath: "/entry/werewolf/812345"
          }
        ],
        featuredRooms: [],
        leaderboardPreview: [],
        universalEntry: {
          heading: "遊戲入口",
          defaultMode: "room-no",
          modes: []
        },
        capabilitySummary: {
          totalPublicRooms: 1
        }
      })
    });
  });

  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        user: null,
        session: null
      })
    });
  });

  await page.route("**/api/room-entry/resolve?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        familyKey: "party",
        gameKey: "werewolf",
        roomNo: "812345",
        detailRoute: "/party/812345",
        joinRoute: "/api/party/rooms/812345/join",
        availability: "snapshot-only",
        roomState: "waiting",
        visibility: "private",
        guestAllowed: true,
        shareUrl: "/entry/werewolf/812345",
        title: "狼人殺",
        strapline: "推理局"
      })
    });
  });

  await page.goto(`${FRONTEND_BASE_URL}/`);

  const liveFeedCard = page.locator('[data-live-feed-room="812345"]');
  await expect(liveFeedCard).toBeVisible();
  await expect(liveFeedCard).toHaveAttribute("data-room-availability", "snapshot-only");
  await expect(liveFeedCard).toContainText("812345");
  await expect(liveFeedCard).toContainText("重啟恢復中");
  await expect(liveFeedCard).toContainText("恢復中");

  await page.goto(`${FRONTEND_BASE_URL}/entry/werewolf/812345`);

  await expect(page.locator('[data-room-availability="snapshot-only"]')).toBeVisible();
  await expect(page.locator('[data-entry-action="guest"]')).toBeDisabled();
  await expect(page.locator('[data-entry-action="guest"]')).toHaveText("房間恢復中");
  await expect(page.locator('[data-entry-action="login"]')).toBeDisabled();
  await expect(page.locator('[data-entry-action="login"]')).toHaveText("等待房間恢復");
  await expect(page.locator('[data-entry-notice="snapshot-only"]')).toBeVisible();
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

async function getAdminRuntime(page) {
  const url = apiUrl(API_ROUTES.admin.runtime());

  const data = await page.evaluate(async ({ requestUrl }) => {
    const response = await fetch(requestUrl, {
      credentials: "include"
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "failed to load runtime controls");
    }

    return payload;
  }, { requestUrl: url });

  return data.controls || [];
}

async function updateRuntimeControl(page, key, value) {
  const url = apiUrl(API_ROUTES.admin.runtime());

  return page.evaluate(async ({ requestUrl, nextKey, nextValue }) => {
    const response = await fetch(requestUrl, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        updates: [
          {
            key: nextKey,
            value: nextValue,
            reason: "playwright-hub-entry-runtime"
          }
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "failed to update runtime control");
    }

    return data;
  }, { requestUrl: url, nextKey: key, nextValue: value });
}

function getRuntimeValue(controls, key, fallbackValue) {
  const match = controls.find((item) => item.key === key);
  return match ? match.value : fallbackValue;
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
