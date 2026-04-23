const { test, expect } = require("playwright/test");
const { API_ROUTES } = require("../lib/client/network-runtime");
const { registerFreshUser } = require("./support/auth");
const { adminBackendJson } = require("./support/admin-backend");
const { waitForConnectedPresence, waitForPartyRoomReady } = require("./support/room-sync");

const FRONTEND_BASE_URL = String(process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3100").replace(/\/+$/, "");
const BACKEND_BASE_URL = FRONTEND_BASE_URL.replace(/:3100$/, ":3101");

test.beforeEach(async () => {
  await setPartyVoiceAvailability("healthy").catch(() => {});
});

test.afterEach(async () => {
  await setPartyVoiceAvailability("healthy").catch(() => {});
});

test("arcade portal and party room creation smoke", async ({ page }) => {
  test.slow();
  page.setDefaultTimeout(30000);

  await registerFreshUser(page, FRONTEND_BASE_URL, "partysmoke");

  await expect(page.getByRole("heading", { name: "遊戲入口", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "遊戲家族", exact: true })).toBeVisible();

  await page.goto(`${FRONTEND_BASE_URL}/games/werewolf`);
  await expect(page.getByRole("heading", { name: "在线狼人杀", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "返回遊戲家族" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "複製邀請" }).first()).toBeVisible();
  await page.getByLabel("角色預設").selectOption("casual");
  await page.getByLabel("房内沟通").selectOption("text");
  await page.getByLabel("猎人反击秒数").fill("25");
  await expect(page.locator('[data-party-role-pack="selected"]')).toContainText("輕量局");
  await expect(page.locator('[data-party-role-pack="selected"]')).toContainText("文字房");
  await expect(page.locator('[data-party-role-pack="selected"]')).toContainText("村民 x3");
  await page.getByRole("button", { name: /立即开/ }).click();
  await expect(page).toHaveURL(/\/party\/\d{6}$/);
  const werewolfRoomNo = page.url().match(/\/party\/(\d{6})$/)[1];
  await waitForPartyRoomReady(page, werewolfRoomNo);
  await expect(page.locator('[data-party-config="true"]')).toContainText("輕量局");
  await expect(page.locator('[data-party-config="true"]')).toContainText("文字房");
  await expect(page.locator('[data-party-config="true"]')).toContainText("猎人反击 25s");
  await expect(page.locator('[data-party-config="true"]')).toContainText("村民 x3");
  await expect(page.getByRole("button", { name: "接通语音" })).toBeVisible();
  await expect(page.getByRole("button", { name: "准备开局" })).toBeVisible();
  await page.getByRole("button", { name: "准备开局" }).click();
  for (let count = 0; count < 5; count += 1) {
    await page.getByRole("button", { name: "补机器人" }).click();
  }
  await expect(page.getByText("对局进行中")).toBeVisible();
  await expect(
    page.getByText(/夜色已落，神职与狼人开始行动|天亮发言，打开语音互相试探|公开投票阶段|猎人翻枪，局势正在瞬间改写/)
  ).toBeVisible();
  await waitForConnectedPresence(page);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/party/${werewolfRoomNo}$`));
  await waitForPartyRoomReady(page, werewolfRoomNo);
  await expect(page.getByText("对局进行中")).toBeVisible({ timeout: 15000 });
  await waitForConnectedPresence(page);

  await page.goto(`${FRONTEND_BASE_URL}/games/avalon`);
  await expect(page.getByRole("heading", { name: "在线阿瓦隆", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "返回遊戲家族" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "複製邀請" }).first()).toBeVisible();
  await page.getByLabel("人数上限").fill("8");
  await page.getByLabel("角色預設").selectOption("classic");
  await page.getByLabel("房内沟通").selectOption("text");
  await expect(page.locator('[data-party-role-pack="selected"]')).toContainText("經典局");
  await expect(page.locator('[data-party-role-pack="selected"]')).toContainText("爪牙");
  await expect(page.locator('[data-party-role-pack="selected"]')).toContainText("文字房");
  await page.getByRole("button", { name: /立即开/ }).click();
  await expect(page).toHaveURL(/\/party\/\d{6}$/);
  const avalonRoomNo = page.url().match(/\/party\/(\d{6})$/)[1];
  await waitForPartyRoomReady(page, avalonRoomNo);
  await expect(page.locator('[data-party-config="true"]')).toContainText("經典局");
  await expect(page.locator('[data-party-config="true"]')).toContainText("爪牙");
  await expect(page.locator('[data-party-config="true"]')).toContainText("文字房");
  await expect(page.getByRole("button", { name: "接通语音" })).toBeVisible();
  await expect(page.getByRole("button", { name: "准备开局" })).toBeVisible();
  await page.getByRole("button", { name: "准备开局" }).click();
  for (let count = 0; count < 4; count += 1) {
    await page.getByRole("button", { name: "补机器人" }).click();
  }
  await expect(page.getByText("对局进行中")).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByText(/队长正在组队|全员表决当前小队|任务成员暗投任务牌|刺客锁定梅林/)
  ).toBeVisible();
});

test("party room surfaces blocked voice guidance without freezing gameplay", async ({ page }) => {
  test.slow();
  page.setDefaultTimeout(30000);
  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: 9001,
          username: "voiceblock_tester",
          displayName: "voiceblock_tester",
          role: "player",
          kind: "user",
          coins: 10000,
          wins: 0,
          losses: 0,
          rankScore: 1000
        },
        session: null
      })
    });
  });

  await page.route("**/api/party/rooms/845612", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        room: {
          roomNo: "845612",
          availability: "live",
          degradedState: {
            state: "blocked",
            label: "已暫停",
            familyKey: "party",
            roomAvailability: "live",
            subsystems: {
              entry: {
                subsystem: "entry",
                state: "healthy",
                label: "正常",
                reasonCode: "",
                message: "",
                safeActions: []
              },
              realtime: {
                subsystem: "realtime",
                state: "healthy",
                label: "正常",
                reasonCode: "",
                message: "",
                safeActions: []
              },
              voice: {
                subsystem: "voice",
                state: "blocked",
                label: "已暫停",
                reasonCode: "party-voice-drain",
                message: "派對 語音暫時停用，請先使用文字溝通。",
                safeActions: ["continue-text-only", "wait"],
                scope: "family",
                familyKey: "party",
                configured: true
              }
            }
          },
          ownerId: 9001,
          title: "在线狼人杀",
          strapline: "夜晚神职操作、白天讨论投票、房内语音直连",
          gameKey: "werewolf",
          state: "waiting",
          config: {
            visibility: "public",
            maxPlayers: 8,
            minPlayers: 6,
            rolePack: "standard",
            voiceEnabled: true,
            hunterSeconds: 20
          },
          createdAt: "2026-04-23T00:00:00.000Z",
          phaseEndsAt: null,
          phaseDurationMs: null,
          lastResult: null,
          feed: [
            {
              text: "voiceblock_tester 创建了 在线狼人杀 房间",
              type: "system"
            }
          ],
          players: [
            {
              seatIndex: 0,
              userId: 9001,
              displayName: "voiceblock_tester",
              isBot: false,
              ready: false,
              connected: true,
              presenceState: "connected",
              recoveryEligible: false,
              reconnectGraceEndsAt: null,
              alive: true,
              voiceConnected: false,
              voiceMuted: false,
              roleLabel: null,
              sideHint: null
            }
          ],
          viewer: {
            userId: 9001,
            seatIndex: 0,
            displayName: "voiceblock_tester",
            isBot: false,
            ready: false,
            connected: true,
            presenceState: "connected",
            recoveryEligible: false,
            reconnectGraceEndsAt: null,
            alive: true,
            voiceConnected: false,
            voiceMuted: false,
            role: null,
            roleLabel: null,
            side: null,
            isOwner: true,
            notes: []
          },
          round: null
        }
      })
    });
  });

  await page.goto(`${FRONTEND_BASE_URL}/party/845612`);

  await expect(page.getByText("房号 845612")).toBeVisible();
  await expect(page.locator('[data-voice-status="blocked"]').first()).toBeVisible();
  await expect(page.locator('[data-safe-action="continue-text-only"]').first()).toContainText(
    "先用文字繼續"
  );
  await expect(page.locator('[data-safe-action="wait"]').first()).toContainText("稍後再試");
  await expect(page.getByRole("button", { name: "語音暫停" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "准备开局" })).toBeVisible();
});

async function createPrivatePartyRoom(page, gameKey) {
  await page.goto(`${FRONTEND_BASE_URL}/games/${gameKey}`);
  await expect(page.getByRole("button", { name: /立即开/ })).toBeVisible();
  const createResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(API_ROUTES.partyRooms.create(gameKey)) &&
      response.request().method() === "POST",
    {
      timeout: 30000
    }
  );
  await page.getByRole("button", { name: /立即开/ }).click();

  const createResponse = await createResponsePromise;
  const payload = await createResponse.json().catch(() => ({}));
  if (!createResponse.ok()) {
    throw new Error(payload.error || "failed to create party room from UI");
  }

  const roomNo = String(payload?.room?.roomNo || "").trim();
  if (!roomNo) {
    throw new Error("failed to resolve created party room number");
  }

  await expect(page).toHaveURL(new RegExp(`/party/${roomNo}$`), {
    timeout: 30000
  });
  return roomNo;
}

async function setPartyVoiceAvailability(state) {
  return adminBackendJson(`${BACKEND_BASE_URL}${API_ROUTES.admin.runtime()}`, {
    method: "PATCH",
    data: {
      availabilityUpdates: [
        {
          scope: "family",
          familyKey: "party",
          subsystem: "voice",
          state,
          reason: "playwright-party-voice"
        }
      ]
    },
    timeout: 15000
  });
}

async function closeAdminLiveRoom(roomNo) {
  return adminBackendJson(`${BACKEND_BASE_URL}${API_ROUTES.admin.liveRooms.action(roomNo)}`, {
    method: "POST",
    data: {
      action: "close"
    },
    timeout: 15000
  });
}
