const { test, expect } = require("playwright/test");
const { API_ROUTES } = require("../lib/client/network-runtime");

const FRONTEND_BASE_URL = String(process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3100").replace(/\/+$/, "");

test("admin console exposes grouped family toggles and recent audit traces", async ({ page }) => {
  page.setDefaultTimeout(30000);

  await loginAsAdmin(page);
  const originalMaxOpenRooms = getRuntimeValue(await getAdminRuntime(page), "maxOpenRoomsPerUser", 3);
  await updateRuntimeControl(page, "maxOpenRoomsPerUser", 10);
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

    await expect
      .poll(() => createCardRoomExpectError(page), {
        timeout: 5000
      })
      .toBe("該遊戲目前未開放新房");

    await page.goto(`${FRONTEND_BASE_URL}/room/${existingRoomNo}`);
    await expect(page.getByRole("button", { name: "準備開局" })).toBeVisible();
  } finally {
    await setGameEnabled(page, "doudezhu", true).catch(() => {});
    await updateRuntimeControl(page, "maxOpenRoomsPerUser", originalMaxOpenRooms).catch(() => {});
  }
});

test("admin template editor surfaces normalized DDZ rules and room summary stays aligned", async ({
  page
}) => {
  page.setDefaultTimeout(30000);

  await loginAsAdmin(page);
  const originalMaxOpenRooms = getRuntimeValue(await getAdminRuntime(page), "maxOpenRoomsPerUser", 3);
  await updateRuntimeControl(page, "maxOpenRoomsPerUser", 10);

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

    const roomNo = await createCardRoom(page, template.id, {});
    await page.goto(`${FRONTEND_BASE_URL}/room/${roomNo}`);

    const roomRules = page.locator('[data-ddz-room-rules="true"]');
    await expect(roomRules).toContainText("30 底分");
    await expect(roomRules).toContainText("叫分至 4");
    await expect(roomRules).toContainText("禁炸彈");
    await expect(roomRules).toContainText("王炸 x3");
    await expect(roomRules).toContainText("春天關閉");
    await expect(roomRules).toContainText("私密桌");
  } finally {
    await updateTemplate(page, restorePayload).catch(() => {});
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

function getRuntimeValue(controls, key, fallbackValue) {
  const match = controls.find((item) => item.key === key);
  return match ? match.value : fallbackValue;
}
