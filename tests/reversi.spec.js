const { test, expect } = require("playwright/test");
const { API_ROUTES } = require("../lib/client/network-runtime");
const { registerFreshUserSession } = require("./support/auth");
const { adminBackendJson } = require("./support/admin-backend");
const { waitForBoardRoomReady, waitForConnectedPresence } = require("./support/room-sync");

const FRONTEND_BASE_URL = String(process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3100").replace(/\/+$/, "");
const BACKEND_BASE_URL = FRONTEND_BASE_URL.replace(/:3100$/, ":3101");

test("reversi lobby, dedicated room route, and deep-link entry smoke", async ({ page }) => {
  test.slow();
  page.setDefaultTimeout(30000);
  let roomNo = "";

  await registerFreshUserSession(page, FRONTEND_BASE_URL, "reversismoke");

  try {
    await page.goto(`${FRONTEND_BASE_URL}/games/reversi`);
    await expect(page.getByRole("heading", { name: "黑白棋", exact: true })).toBeVisible();
    await page.getByRole("button", { name: /立即开/ }).click();
    await expect(page).toHaveURL(/\/reversi\/\d{6}$/);

    roomNo = page.url().match(/\/reversi\/(\d{6})$/)[1];
    await waitForBoardRoomReady(page, roomNo);
    await page.getByRole("button", { name: "准备开局" }).click();
    await page.getByRole("button", { name: "补机器人" }).click();

    await expect(page.locator('[data-reversi-legal="true"]').first()).toBeVisible();
    const legalMove = page.locator('[data-reversi-legal="true"]').first();
    const moveCell = await legalMove.getAttribute("data-reversi-cell");
    await legalMove.click();
    await expect(page.locator(`[data-reversi-cell="${moveCell}"]`)).toHaveAttribute("data-reversi-piece", "black");
    await page.getByRole("button", { name: /^席位 \d/ }).click();
    await waitForConnectedPresence(page);

    await page.goto(`${FRONTEND_BASE_URL}/entry/reversi/${roomNo}`);
    await expect(page).toHaveURL(new RegExp(`/reversi/${roomNo}$`));
    await waitForBoardRoomReady(page, roomNo);
    await expect(page.getByText(`房号 ${roomNo}`)).toBeVisible();
  } finally {
    if (roomNo) {
      await closeAdminLiveRoom(roomNo).catch(() => {});
    }
  }
});

async function closeAdminLiveRoom(roomNo) {
  return adminBackendJson(`${BACKEND_BASE_URL}${API_ROUTES.admin.liveRooms.action(roomNo)}`, {
    method: "POST",
    data: {
      action: "close"
    },
    timeout: 12000,
    attempts: 1
  });
}
