const { test, expect } = require("playwright/test");
const { API_ROUTES } = require("../lib/client/network-runtime");

const FRONTEND_BASE_URL = String(process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3100").replace(/\/+$/, "");

test("admin console exposes grouped family toggles and recent audit traces", async ({ page }) => {
  page.setDefaultTimeout(30000);

  await loginAsAdmin(page);
  const originalMaxOpenRooms = await ensureAdminRoomCapacity(page, 2);
  await setGameEnabled(page, "doudezhu", true);
  let existingRoomNo = "";

  try {
    existingRoomNo = await createCardRoom(page);
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

    await expect
      .poll(() => createCardRoomExpectError(page), {
        timeout: 5000
      })
      .toBe("該遊戲目前未開放新房");

    await page.goto(`${FRONTEND_BASE_URL}/room/${existingRoomNo}`);
    await expect(page.getByRole("button", { name: "準備開局" })).toBeVisible();
  } finally {
    if (existingRoomNo) {
      await closeAdminLiveRoom(page, existingRoomNo).catch(() => {});
    }
    await setGameEnabled(page, "doudezhu", true).catch(() => {});
    await updateRuntimeControl(page, "maxOpenRoomsPerUser", originalMaxOpenRooms).catch(() => {});
  }
});

test("admin template editor surfaces normalized DDZ rules and room summary stays aligned", async ({
  page
}) => {
  page.setDefaultTimeout(30000);

  await loginAsAdmin(page);
  const originalMaxOpenRooms = await ensureAdminRoomCapacity(page, 2);
  let roomNo = "";

  const templates = await getAdminTemplates(page);
  const template = templates.find((item) => item.name === "classic-ranked") || templates[0];
  const restorePayload = {
    id: template.id,
    name: template.name,
    title: template.title,
    description: template.description,
    mode: template.mode,
    isActive: template.isActive,
    settings: template.settings
  };

  try {
    await updateTemplate(page, {
      id: template.id,
      settings: {
        ...template.settings,
        baseScore: 30,
        bidOptions: [0, 1, 2, 3, 4],
        maxRobMultiplier: 4,
        allowBomb: false,
        allowRocket: true,
        rocketMultiplier: 3,
        allowSpring: false,
        roomVisibility: "private"
      }
    });

    await page.goto(`${FRONTEND_BASE_URL}/admin`);
    await expect(page.locator('[data-template-support-note="true"]')).toContainText(
      "CLASSIC / ROB / NO_SHUFFLE"
    );

    const templateCard = page.locator(`[data-admin-template="${template.name}"]`);
    await expect(templateCard).toContainText("叫分至 4");
    await expect(templateCard).toContainText("禁炸彈");
    await expect(templateCard).toContainText("王炸 x3");
    await expect(templateCard).toContainText("春天關閉");
    await expect(templateCard).toContainText("私密桌");

    roomNo = await createCardRoom(page, template.id, {});
    await page.goto(`${FRONTEND_BASE_URL}/room/${roomNo}`);

    const roomRules = page.locator('[data-ddz-room-rules="true"]');
    await expect(roomRules).toContainText("30 底分");
    await expect(roomRules).toContainText("叫分至 4");
    await expect(roomRules).toContainText("禁炸彈");
    await expect(roomRules).toContainText("王炸 x3");
    await expect(roomRules).toContainText("春天關閉");
    await expect(roomRules).toContainText("私密桌");
  } finally {
    if (roomNo) {
      await closeAdminLiveRoom(page, roomNo).catch(() => {});
    }
    await updateTemplate(page, restorePayload).catch(() => {});
    await updateRuntimeControl(page, "maxOpenRoomsPerUser", originalMaxOpenRooms).catch(() => {});
  }
});

test("admin console drives live room inspect, remove, drain, and close workflows", async ({
  page,
  browser
}) => {
  page.setDefaultTimeout(30000);

  await loginAsAdmin(page);
  const originalMaxOpenRooms = await ensureAdminRoomCapacity(page, 2);
  const guestContext = await browser.newContext();
  let roomNo = "";

  try {
    roomNo = await createPrivatePartyRoom(page, "werewolf");
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`${FRONTEND_BASE_URL}/entry/werewolf/${roomNo}`);
    await guestPage.getByRole("button", { name: "以遊客進入" }).click();
    await expect(guestPage).toHaveURL(new RegExp(`/party/${roomNo}$`));
    await guestContext.close();

    await page.goto(`${FRONTEND_BASE_URL}/admin`);

    const roomRow = page.locator(`[data-live-room-row="${roomNo}"]`);
    await expect(roomRow).toBeVisible();
    await expect(roomRow).toHaveAttribute("data-room-availability", "live");

    await roomRow.getByRole("button", { name: "查看房間詳情" }).click();

    const detail = page.locator(`[data-live-room-detail="${roomNo}"]`);
    await expect(detail).toBeVisible();

    const removableOccupant = detail.locator('[data-room-occupant]').nth(1);
    await expect(removableOccupant).toBeVisible();
    await removableOccupant.locator('[data-room-occupant-action="remove"]').click();
    await expect(detail.locator('[data-room-action-confirm="remove-occupant"]')).toBeVisible();
    await detail.getByRole("button", { name: "再次點擊移除玩家" }).click();
    await expect(detail.locator('[data-room-occupant]')).toHaveCount(1, { timeout: 15000 });

    await detail.locator('[data-room-action="drain"]').click();
    await expect(detail.locator('[data-room-action-confirm="drain"]')).toBeVisible();
    await detail.locator('[data-room-action-confirm="drain"] input').fill(roomNo);
    await detail.getByRole("button", { name: "確認排空" }).click();
    await expect(roomRow).toHaveAttribute("data-room-availability", "draining");

    await detail.locator('[data-room-action="close"]').click();
    await expect(detail.locator('[data-room-action-confirm="close"]')).toBeVisible();
    await detail.locator('[data-room-action-confirm="close"] input').fill("CLOSE");
    await detail.getByRole("button", { name: "立即關閉" }).click();
    await expect(roomRow).toHaveAttribute("data-room-availability", "closed");
    await expect(detail).toHaveAttribute("data-room-availability", "closed");

    await expect(page.locator("[data-audit-row]").first()).toContainText("關閉房間");
    await expect(page.locator("[data-audit-row]").first()).toContainText(roomNo);
  } finally {
    await guestContext.close().catch(() => {});
    if (roomNo) {
      await closeAdminLiveRoom(page, roomNo).catch(() => {});
    }
    await updateRuntimeControl(page, "maxOpenRoomsPerUser", originalMaxOpenRooms).catch(() => {});
  }
});

async function loginAsAdmin(page) {
  await page.goto(`${FRONTEND_BASE_URL}/login`);
  await page.getByLabel("帳號或郵箱").fill("admin");
  await page.getByLabel("密碼").fill("Admin123456");
  await page.getByRole("button", { name: "登入" }).click();
  await expect(page).toHaveURL(`${FRONTEND_BASE_URL}/`);
}

async function createCardRoom(page, templateId = 1, overrides = null) {
  const url = API_ROUTES.cardRooms.create();

  return page.evaluate(async ({ requestUrl, nextTemplateId, nextOverrides }) => {
    const response = await fetch(requestUrl, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        templateId: nextTemplateId,
        overrides:
          nextOverrides || {
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
  }, { requestUrl: url, nextTemplateId: templateId, nextOverrides: overrides });
}

async function createPrivatePartyRoom(page, gameKey) {
  const url = API_ROUTES.partyRooms.create(gameKey);

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

async function createCardRoomExpectError(page) {
  const url = API_ROUTES.cardRooms.create();

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
  const url = API_ROUTES.admin.capabilities();

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

async function getAdminTemplates(page) {
  const url = API_ROUTES.admin.templates();

  const data = await page.evaluate(async ({ requestUrl }) => {
    const response = await fetch(requestUrl, {
      credentials: "include"
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "failed to load templates");
    }

    return payload;
  }, { requestUrl: url });

  return data.items || [];
}

async function updateTemplate(page, payload) {
  const url = API_ROUTES.admin.templates();

  return page.evaluate(async ({ requestUrl, nextPayload }) => {
    const response = await fetch(requestUrl, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(nextPayload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "failed to update template");
    }

    return data;
  }, { requestUrl: url, nextPayload: payload });
}

async function getAdminRuntime(page) {
  const url = API_ROUTES.admin.runtime();

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

async function getAdminLiveRooms(page) {
  const url = API_ROUTES.admin.liveRooms.list();

  const data = await page.evaluate(async ({ requestUrl }) => {
    const response = await fetch(requestUrl, {
      credentials: "include"
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "failed to load live rooms");
    }

    return payload;
  }, { requestUrl: url });

  return data.items || [];
}

async function getCurrentViewer(page) {
  const url = API_ROUTES.me();

  const data = await page.evaluate(async ({ requestUrl }) => {
    const response = await fetch(requestUrl, {
      credentials: "include"
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "failed to load viewer session");
    }

    return payload;
  }, { requestUrl: url });

  return data.user || data.session || null;
}

async function updateRuntimeControl(page, key, value) {
  const url = API_ROUTES.admin.runtime();

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
            reason: "playwright-admin-console-runtime"
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

async function ensureAdminRoomCapacity(page, additionalRooms = 1) {
  const [controls, viewer, liveRooms] = await Promise.all([
    getAdminRuntime(page),
    getCurrentViewer(page),
    getAdminLiveRooms(page)
  ]);
  const originalMaxOpenRooms = getRuntimeValue(controls, "maxOpenRoomsPerUser", 3);
  const viewerId = viewer?.id == null ? "" : String(viewer.id);
  const ownedRoomCount = liveRooms.filter((room) => String(room.ownerId || "") === viewerId).length;
  const nextMaxOpenRooms = Math.max(originalMaxOpenRooms, ownedRoomCount + additionalRooms + 1);

  if (nextMaxOpenRooms !== originalMaxOpenRooms) {
    await updateRuntimeControl(page, "maxOpenRoomsPerUser", nextMaxOpenRooms);
  }

  return originalMaxOpenRooms;
}

async function closeAdminLiveRoom(page, roomNo) {
  const url = API_ROUTES.admin.liveRooms.action(roomNo);

  return page.evaluate(async ({ requestUrl }) => {
    const response = await fetch(requestUrl, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "close"
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "failed to close room");
    }

    return data;
  }, { requestUrl: url });
}

function getRuntimeValue(controls, key, fallbackValue) {
  const match = controls.find((item) => item.key === key);
  return match ? match.value : fallbackValue;
}
