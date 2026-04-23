const { test, expect } = require("playwright/test");
const { registerFreshUser } = require("./support/auth");
const { waitForConnectedPresence, waitForUndercoverRoomReady } = require("./support/room-sync");

const FRONTEND_BASE_URL = String(process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3100").replace(/\/+$/, "");

test("undercover dedicated room route supports one clue and vote loop", async ({ page }) => {
  page.setDefaultTimeout(30000);

  await registerFreshUser(page, FRONTEND_BASE_URL, "undercoversmoke");

  await page.goto(`${FRONTEND_BASE_URL}/games/undercover`);
  await expect(page.getByRole("heading", { name: "誰是臥底", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /立即开/ }).click();
  await expect(page).toHaveURL(/\/undercover\/\d{6}$/);

  const roomNo = page.url().match(/\/undercover\/(\d{6})$/)[1];
  await waitForUndercoverRoomReady(page, roomNo);
  await page.getByRole("button", { name: "準備開局" }).click();
  for (let count = 0; count < 3; count += 1) {
    await page.getByRole("button", { name: "補機器人" }).click();
  }

  await expect(page.locator("[data-undercover-word]")).not.toHaveText("等待發詞");
  await page.getByRole("textbox").fill("這個詞跟日常很有關");
  await page.getByRole("button", { name: "提交描述" }).click();

  await expect(page.getByText("公開投票階段", { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: /^投給 / }).first()).toBeVisible({ timeout: 15000 });
  await waitForConnectedPresence(page);
  await page.getByRole("button", { name: /^投給 / }).first().click();
  await expect(page).toHaveURL(new RegExp(`/undercover/${roomNo}$`));
  await expect(page.getByText(`房號 ${roomNo}`)).toBeVisible();
});

test("undercover active speaker can access the mic path when voice is degraded", async ({
  page
}) => {
  page.setDefaultTimeout(30000);

  await page.addInitScript(() => {
    const fakeTrack = {
      kind: "audio",
      enabled: true,
      stop() {}
    };
    window.navigator.mediaDevices = {
      getUserMedia: async () => ({
        getAudioTracks: () => [fakeTrack],
        getTracks: () => [fakeTrack]
      })
    };
  });

  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: 9201,
          username: "undercover_voice",
          displayName: "undercover_voice",
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
            state: "degraded",
            label: "降級中",
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
                state: "degraded",
                label: "降級中",
                reasonCode: "party-voice-unstable",
                message: "誰是臥底語音波動中，輪到描述者再開咪；若接通失敗可稍後重試。",
                safeActions: ["retry", "active-speaker-only"],
                scope: "family",
                familyKey: "party",
                configured: true
              }
            }
          },
          ownerId: 9201,
          title: "誰是臥底",
          strapline: "詞題分歧、輪流描述、抓出那個不對勁的人",
          gameKey: "undercover",
          state: "playing",
          config: {
            visibility: "private",
            maxPlayers: 6,
            discussionSeconds: 45,
            voteSeconds: 30,
            voiceEnabled: true
          },
          createdAt: "2026-04-23T00:00:00.000Z",
          phaseEndsAt: null,
          phaseDurationMs: null,
          lastResult: null,
          feed: [
            {
              id: "f-1",
              text: "undercover_voice 進入房間",
              type: "system"
            }
          ],
          players: [
            {
              seatIndex: 0,
              userId: 9201,
              displayName: "undercover_voice",
              isBot: false,
              ready: true,
              connected: true,
              presenceState: "connected",
              recoveryEligible: false,
              reconnectGraceEndsAt: null,
              alive: true,
              voiceConnected: false,
              voiceMuted: true,
              roleLabel: "平民"
            },
            {
              seatIndex: 1,
              userId: 9202,
              displayName: "對手 A",
              isBot: false,
              ready: true,
              connected: true,
              presenceState: "connected",
              recoveryEligible: false,
              reconnectGraceEndsAt: null,
              alive: true,
              voiceConnected: false,
              voiceMuted: true,
              roleLabel: null
            }
          ],
          viewer: {
            userId: 9201,
            seatIndex: 0,
            displayName: "undercover_voice",
            isBot: false,
            ready: true,
            connected: true,
            presenceState: "connected",
            recoveryEligible: false,
            reconnectGraceEndsAt: null,
            alive: true,
            voiceConnected: false,
            voiceMuted: true,
            role: "civilian",
            roleLabel: "平民",
            side: "civilian",
            isOwner: true,
            notes: []
          },
          round: {
            stage: "clue",
            roundNo: 1,
            activeSeat: 0,
            aliveSeats: [0, 1],
            aliveCount: 2,
            votesSubmitted: 0,
            myVote: null,
            clues: [],
            privateRole: "civilian",
            privatePrompt: "咖啡"
          }
        }
      })
    });
  });

  await page.goto(`${FRONTEND_BASE_URL}/undercover/845612`);

  await expect(page.locator('[data-voice-status="degraded"]').first()).toBeVisible();
  await expect(page.locator('[data-safe-action="active-speaker-only"]').first()).toContainText(
    "輪到描述者再開咪"
  );
  await expect(page.locator('[data-voice-action="join"]')).toHaveText("重試開咪");
  await expect(page.locator('[data-voice-action="join"]')).toBeEnabled();
});

test("undercover listeners are told to wait for their speaking turn", async ({ page }) => {
  page.setDefaultTimeout(30000);

  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: 9301,
          username: "undercover_listener",
          displayName: "undercover_listener",
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

  await page.route("**/api/party/rooms/845613", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        room: {
          roomNo: "845613",
          availability: "live",
          degradedState: {
            state: "healthy",
            label: "正常",
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
                state: "healthy",
                label: "正常",
                reasonCode: "",
                message: "",
                safeActions: []
              }
            }
          },
          ownerId: 9302,
          title: "誰是臥底",
          strapline: "詞題分歧、輪流描述、抓出那個不對勁的人",
          gameKey: "undercover",
          state: "playing",
          config: {
            visibility: "private",
            maxPlayers: 6,
            discussionSeconds: 45,
            voteSeconds: 30,
            voiceEnabled: true
          },
          createdAt: "2026-04-23T00:00:00.000Z",
          phaseEndsAt: null,
          phaseDurationMs: null,
          lastResult: null,
          feed: [
            {
              id: "f-2",
              text: "輪到房主描述",
              type: "system"
            }
          ],
          players: [
            {
              seatIndex: 0,
              userId: 9301,
              displayName: "undercover_listener",
              isBot: false,
              ready: true,
              connected: true,
              presenceState: "connected",
              recoveryEligible: false,
              reconnectGraceEndsAt: null,
              alive: true,
              voiceConnected: false,
              voiceMuted: true,
              roleLabel: "平民"
            },
            {
              seatIndex: 1,
              userId: 9302,
              displayName: "房主",
              isBot: false,
              ready: true,
              connected: true,
              presenceState: "connected",
              recoveryEligible: false,
              reconnectGraceEndsAt: null,
              alive: true,
              voiceConnected: true,
              voiceMuted: false,
              roleLabel: null
            }
          ],
          viewer: {
            userId: 9301,
            seatIndex: 0,
            displayName: "undercover_listener",
            isBot: false,
            ready: true,
            connected: true,
            presenceState: "connected",
            recoveryEligible: false,
            reconnectGraceEndsAt: null,
            alive: true,
            voiceConnected: false,
            voiceMuted: true,
            role: "civilian",
            roleLabel: "平民",
            side: "civilian",
            isOwner: false,
            notes: []
          },
          round: {
            stage: "clue",
            roundNo: 1,
            activeSeat: 1,
            aliveSeats: [0, 1],
            aliveCount: 2,
            votesSubmitted: 0,
            myVote: null,
            clues: [],
            privateRole: "civilian",
            privatePrompt: "咖啡"
          }
        }
      })
    });
  });

  await page.goto(`${FRONTEND_BASE_URL}/undercover/845613`);

  await expect(page.locator('[data-voice-turn="listener"]').first()).toBeVisible();
  await expect(page.locator('[data-voice-action="join"]')).toHaveText("接入旁聽");
  await expect(page.getByText("等待 房主 發言", { exact: false })).toBeVisible();
});
