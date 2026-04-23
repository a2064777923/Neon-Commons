const { test, expect } = require("playwright/test");

const FRONTEND_BASE_URL = String(process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3100").replace(/\/+$/, "");

test("homepage hub shows family arcade states", async ({ page }) => {
  test.slow();
  page.setDefaultTimeout(30000);

  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        user: null,
        session: null
      })
    });
  });

  await page.route("**/api/hub", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        families: [
          {
            familyKey: "card",
            label: "經典牌桌",
            strapline: "一個牌桌入口，支持房號直達",
            items: [
              {
                familyKey: "card",
                gameKey: "doudezhu",
                title: "斗地主",
                strapline: "三人明牌压制、炸弹翻倍、手牌滑选",
                state: "paused-new-rooms",
                stateLabel: "暫停新房",
                stateDescription: "目前不開新房，已有房號或邀請可直接加入。",
                route: "/lobby",
                launchMode: "room",
                roomCount: 1,
                discoveryTags: ["經典", "牌桌"]
              }
            ]
          },
          {
            familyKey: "party",
            label: "推理派對",
            strapline: "語音與多人推理入口",
            items: [
              {
                familyKey: "party",
                gameKey: "werewolf",
                title: "在线狼人杀",
                strapline: "夜晚神职操作、白天讨论投票、房内语音直连",
                state: "playable",
                stateLabel: "可立即遊玩",
                stateDescription: "可立即遊玩，依遊戲類型直接開始或進入專屬大廳。",
                route: "/games/werewolf",
                launchMode: "room",
                roomCount: 2,
                discoveryTags: ["多人", "語音"]
              },
              {
                familyKey: "party",
                gameKey: "undercover",
                title: "誰是臥底",
                strapline: "詞題分歧、輪流描述、抓出那個不對勁的人",
                state: "playable",
                stateLabel: "可立即遊玩",
                stateDescription: "可立即遊玩，依遊戲類型直接開始或進入專屬大廳。",
                route: "/games/undercover",
                launchMode: "room",
                roomCount: 0,
                discoveryTags: ["派對", "文字"]
              },
              {
                familyKey: "party",
                gameKey: "drawguess",
                title: "你畫我猜",
                strapline: "多人接龍、畫錯也能變梗",
                state: "coming-soon",
                stateLabel: "即將推出",
                stateDescription: "入口保留中，完成後會直接在這裡開放。",
                route: "",
                launchMode: "room",
                roomCount: 0,
                discoveryTags: ["派對", "新作"]
              }
            ]
          },
          {
            familyKey: "board",
            label: "棋盤對戰",
            strapline: "棋盤與策略對局入口",
            items: [
              {
                familyKey: "board",
                gameKey: "gomoku",
                title: "在线五子棋",
                strapline: "15 路棋盘、先手抢势、五连即胜",
                state: "playable",
                stateLabel: "可立即遊玩",
                stateDescription: "可立即遊玩，依遊戲類型直接開始或進入專屬大廳。",
                route: "/games/gomoku",
                launchMode: "room",
                roomCount: 0,
                discoveryTags: ["棋盤", "雙人"]
              },
              {
                familyKey: "board",
                gameKey: "reversi",
                title: "黑白棋",
                strapline: "角位争夺、翻面反杀、短局也有层次",
                state: "playable",
                stateLabel: "可立即遊玩",
                stateDescription: "可立即遊玩，依遊戲類型直接開始或進入專屬大廳。",
                route: "/games/reversi",
                launchMode: "room",
                roomCount: 0,
                discoveryTags: ["棋盤", "雙人"]
              },
              {
                familyKey: "board",
                gameKey: "chinesecheckers",
                title: "在线跳棋",
                strapline: "六角星盘、完整营地对冲、连跳抢线",
                state: "playable",
                stateLabel: "可立即遊玩",
                stateDescription: "可立即遊玩，依遊戲類型直接開始或進入專屬大廳。",
                route: "/games/chinesecheckers",
                launchMode: "room",
                roomCount: 0,
                discoveryTags: ["棋盤", "多人"]
              }
            ]
          },
          {
            familyKey: "solo",
            label: "單人闖關",
            strapline: "直接開始，不需房號",
            items: [
              {
                familyKey: "solo",
                gameKey: "sokoban",
                title: "推箱子",
                strapline: "單人闖關、關卡遞進、很適合補空檔",
                state: "playable",
                stateLabel: "可立即遊玩",
                stateDescription: "可立即遊玩，依遊戲類型直接開始或進入專屬大廳。",
                route: "/games/sokoban",
                launchMode: "direct",
                roomCount: 0,
                discoveryTags: ["單人", "闖關"]
              },
              {
                familyKey: "solo",
                gameKey: "uno",
                title: "UNO 類",
                strapline: "多人規則先保留，等待第二波上線",
                state: "coming-soon",
                stateLabel: "即將推出",
                stateDescription: "入口保留中，完成後會直接在這裡開放。",
                route: "",
                launchMode: "room",
                roomCount: 0,
                discoveryTags: ["卡牌", "新作"]
              }
            ]
          }
        ],
        liveFeed: [],
        featuredRooms: [],
        leaderboardPreview: [],
        universalEntry: {
          heading: "遊戲入口",
          defaultMode: "room-no",
          modes: []
        },
        capabilitySummary: {
          totalPublicRooms: 3
        }
      })
    });
  });

  await page.goto(`${FRONTEND_BASE_URL}/`);
  await expect(page.getByRole("heading", { name: "遊戲入口", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "遊戲家族", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "推箱子", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "黑白棋", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "誰是臥底", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "UNO 類", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "你畫我猜", exact: true })).toBeVisible();
  await expect(page.getByText("直接開始，不需房號").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "立即遊玩" }).first()).toBeVisible();
  await expect(page.getByText("暫停新房").first()).toBeVisible();
  await expect(page.getByText("即將推出").first()).toBeVisible();
  await expect(page.getByText("目前不開新房，已有房號或邀請可直接加入。").first()).toBeVisible();
});

test("logged-out invite deep link can enter eligible room as guest", async ({ page }) => {
  test.slow();
  page.setDefaultTimeout(30000);

  let guestEntered = false;

  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        guestEntered
          ? {
              user: null,
              session: {
                kind: "guest",
                id: "guest-845612",
                guestId: "guest-845612",
                username: "guest-845612",
                displayName: "夜局遊客",
                role: "guest",
                status: "guest",
                gameKey: "werewolf",
                roomNo: "845612",
                recoveryEligible: true,
                presenceState: "connected"
              }
            }
          : {
              user: null,
              session: null
            }
      )
    });
  });

  await page.route("**/api/room-entry/resolve?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        familyKey: "party",
        gameKey: "werewolf",
        roomNo: "845612",
        detailRoute: "/party/845612",
        joinRoute: "/api/party/rooms/845612/join",
        availability: "live",
        roomState: "waiting",
        visibility: "private",
        guestAllowed: true,
        shareUrl: "/entry/werewolf/845612",
        title: "邀請狼人局",
        strapline: "遊客可直接入場"
      })
    });
  });

  await page.route("**/api/room-entry/guest", async (route) => {
    guestEntered = true;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        detailRoute: "/party/845612"
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
          ownerId: 9002,
          title: "在线狼人杀",
          strapline: "夜晚神职操作、白天讨论投票、房内语音直连",
          gameKey: "werewolf",
          state: "waiting",
          config: {
            visibility: "private",
            maxPlayers: 6,
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
              text: "夜局遊客 加入了 在線狼人杀 房间",
              type: "join"
            }
          ],
          players: [
            {
              seatIndex: 0,
              userId: "guest-845612",
              displayName: "夜局遊客",
              isBot: false,
              ready: false,
              connected: true,
              presenceState: "connected",
              recoveryEligible: true,
              reconnectGraceEndsAt: null,
              alive: true,
              voiceConnected: false,
              voiceMuted: false,
              roleLabel: null,
              sideHint: null
            }
          ],
          viewer: {
            userId: "guest-845612",
            seatIndex: 0,
            displayName: "夜局遊客",
            isBot: false,
            ready: false,
            connected: true,
            presenceState: "connected",
            recoveryEligible: true,
            reconnectGraceEndsAt: null,
            alive: true,
            voiceConnected: false,
            voiceMuted: false,
            role: null,
            roleLabel: null,
            side: null,
            isOwner: false,
            notes: []
          },
          round: null
        }
      })
    });
  });

  await page.goto(`${FRONTEND_BASE_URL}/entry/werewolf/845612`);

  await expect(page.getByRole("button", { name: "以遊客進入" })).toBeVisible();
  await expect(page.getByRole("button", { name: "登入後進入" })).toBeVisible();
  await expect(page.getByRole("link", { name: "先回遊戲家族" })).toBeVisible();

  await page.getByRole("button", { name: "以遊客進入" }).click();
  await expect(page).toHaveURL(/\/party\/845612$/);
  await expect(page.getByText("房号 845612")).toBeVisible();
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

test("hub and room-entry render blocked entry guidance from the shared degraded contract", async ({
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
            roomNo: "845612",
            familyKey: "party",
            gameKey: "werewolf",
            title: "入口受控房",
            strapline: "派對房入口維護",
            roomState: "waiting",
            visibility: "private",
            playerCount: 5,
            availability: "live",
            detailRoute: "/party/845612",
            entryRoute: "/entry/werewolf/845612",
            sharePath: "/entry/werewolf/845612",
            degradedState: {
              state: "blocked",
              label: "已暫停",
              familyKey: "party",
              roomAvailability: "live",
              subsystems: {
                entry: {
                  subsystem: "entry",
                  state: "blocked",
                  label: "已暫停",
                  reasonCode: "party-entry-drain",
                  message: "派對房入口維護中，請先保留邀請。",
                  safeActions: ["wait", "share-link"],
                  scope: "family",
                  familyKey: "party",
                  configured: true
                },
                realtime: {
                  subsystem: "realtime",
                  state: "healthy",
                  label: "正常",
                  reasonCode: "",
                  message: "",
                  safeActions: [],
                  scope: "global",
                  familyKey: "",
                  configured: false
                },
                voice: {
                  subsystem: "voice",
                  state: "degraded",
                  label: "降級中",
                  reasonCode: "party-voice-unstable",
                  message: "派對語音不穩定，可先文字溝通。",
                  safeActions: ["retry", "continue-text-only"],
                  scope: "family",
                  familyKey: "party",
                  configured: true
                }
              }
            }
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
        roomNo: "845612",
        detailRoute: "/party/845612",
        joinRoute: "/api/party/rooms/845612/join",
        availability: "live",
        roomState: "waiting",
        visibility: "private",
        guestAllowed: true,
        shareUrl: "/entry/werewolf/845612",
        title: "入口受控房",
        strapline: "派對房入口維護",
        degradedState: {
          state: "blocked",
          label: "已暫停",
          familyKey: "party",
          roomAvailability: "live",
          subsystems: {
            entry: {
              subsystem: "entry",
              state: "blocked",
              label: "已暫停",
              reasonCode: "party-entry-drain",
              message: "派對房入口維護中，請先保留邀請。",
              safeActions: ["wait", "share-link"],
              scope: "family",
              familyKey: "party",
              configured: true
            },
            realtime: {
              subsystem: "realtime",
              state: "healthy",
              label: "正常",
              reasonCode: "",
              message: "",
              safeActions: [],
              scope: "global",
              familyKey: "",
              configured: false
            },
            voice: {
              subsystem: "voice",
              state: "degraded",
              label: "降級中",
              reasonCode: "party-voice-unstable",
              message: "派對語音不穩定，可先文字溝通。",
              safeActions: ["retry", "continue-text-only"],
              scope: "family",
              familyKey: "party",
              configured: true
            }
          }
        }
      })
    });
  });

  await page.goto(`${FRONTEND_BASE_URL}/`);

  const liveFeedCard = page.locator('[data-live-feed-room="845612"]');
  await expect(liveFeedCard).toBeVisible();
  await expect(liveFeedCard).toHaveAttribute("data-entry-status", "blocked");
  await expect(liveFeedCard).toContainText("派對房入口維護中");
  await expect(liveFeedCard).toContainText("稍後再試");
  await expect(liveFeedCard).toContainText("保留邀請");
  await expect(liveFeedCard).toContainText("入口暫停");

  await page.goto(`${FRONTEND_BASE_URL}/entry/werewolf/845612`);

  await expect(page.locator('[data-entry-status="blocked"]').first()).toBeVisible();
  await expect(page.locator('[data-entry-action="guest"]')).toBeDisabled();
  await expect(page.locator('[data-entry-action="login"]')).toBeDisabled();
  await expect(page.locator('[data-availability-reason="party-entry-drain"]').first()).toBeVisible();
  await expect(page.locator('[data-safe-action="wait"]')).toContainText("稍後再試");
  await expect(page.locator('[data-safe-action="share-link"]')).toContainText("保留邀請");
  await expect(page.locator('[data-entry-notice="blocked-entry"]')).toBeVisible();
});
