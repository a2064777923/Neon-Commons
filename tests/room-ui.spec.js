const { test, expect } = require("playwright/test");
const { API_ROUTES, apiUrl } = require("../lib/client/network-runtime");

const FRONTEND_BASE_URL = String(process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3100").replace(/\/+$/, "");

test("desktop and landscape room ui smoke", async ({ page }) => {
  page.setDefaultTimeout(30000);

  await page.goto(`${FRONTEND_BASE_URL}/login`);
  await page.getByLabel("帳號或郵箱").fill("smoke202604171508");
  await page.getByLabel("密碼").fill("Smoke123456");
  await page.getByRole("button", { name: "登入" }).click();
  await expect(page).toHaveURL(`${FRONTEND_BASE_URL}/`);

  const createRoomUrl = apiUrl(API_ROUTES.cardRooms.create());
  const roomNo = await page.evaluate(async ({ url }) => {
    const response = await fetch(url, {
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
          autoTrusteeMinSeconds: 2,
          autoTrusteeMaxSeconds: 4,
          roomVisibility: "private"
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "failed to create room");
    }

    return data.room.roomNo;
  }, { url: createRoomUrl });

  await page.goto(`${FRONTEND_BASE_URL}/room/${roomNo}`);
  await page.getByRole("button", { name: "準備開局" }).click();
  await page.getByRole("button", { name: "補機器人" }).click();
  await page.getByRole("button", { name: "補機器人" }).click();

  await page.waitForSelector('[data-card-id]');
  const desktopCount = await page.locator('[data-card-id]').count();
  expect([17, 20]).toContain(desktopCount);
  await expect(page.getByText(/正在叫地主|正在出牌/)).toBeVisible();
  await expectStableDockLayout(page, 0.34);
  await page.getByRole("button", { name: "要不起" }).click();
  await expect(page.locator('[data-chat-slot="bottom"]')).toContainText("要不起");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: "/tmp/doudezhu-room-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 844, height: 390 });
  await page.reload();
  await page.waitForSelector('[data-card-id]');
  const landscapeCount = await page.locator('[data-card-id]').count();
  expect([17, 20]).toContain(landscapeCount);
  await expectStableDockLayout(page, 0.4);
  await page.screenshot({ path: "/tmp/doudezhu-room-landscape.png", fullPage: true });
});

async function expectStableDockLayout(page, maxSelfWidthRatio) {
  const dockBox = await getBox(page, '[data-room-dock="bottom"]');
  const selfBox = await getBox(page, '[data-seat-slot="self"]');
  const handBox = await getBox(page, '[data-hand-rail="true"]');
  const controlBox = await getBox(page, '[data-control-dock="true"]');
  const leftBox = await getBox(page, '[data-seat-slot="left"]');
  const rightBox = await getBox(page, '[data-seat-slot="right"]');

  expect(boxesOverlap(selfBox, handBox)).toBeFalsy();
  expect(boxesOverlap(selfBox, controlBox)).toBeFalsy();
  expect(boxesOverlap(selfBox, leftBox)).toBeFalsy();
  expect(boxesOverlap(selfBox, rightBox)).toBeFalsy();
  expect(selfBox.width / dockBox.width).toBeLessThanOrEqual(maxSelfWidthRatio);
}

async function getBox(page, selector) {
  const box = await page.locator(selector).boundingBox();
  expect(box).not.toBeNull();
  return box;
}

function boxesOverlap(a, b) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}
