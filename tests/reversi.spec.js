const { test, expect } = require("playwright/test");
const { registerFreshUser } = require("./support/auth");

const FRONTEND_BASE_URL = String(process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3100").replace(/\/+$/, "");

test("reversi lobby, dedicated room route, and deep-link entry smoke", async ({ page }) => {
  page.setDefaultTimeout(30000);

  await registerFreshUser(page, FRONTEND_BASE_URL, "reversismoke");

  await page.goto(`${FRONTEND_BASE_URL}/games/reversi`);
  await expect(page.getByRole("heading", { name: "黑白棋", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /立即开/ }).click();
  await expect(page).toHaveURL(/\/reversi\/\d{6}$/);

  const roomNo = page.url().match(/\/reversi\/(\d{6})$/)[1];
  await page.getByRole("button", { name: "准备开局" }).click();
  await page.getByRole("button", { name: "补机器人" }).click();

  await expect(page.locator('[data-reversi-legal="true"]').first()).toBeVisible();
  const legalMove = page.locator('[data-reversi-legal="true"]').first();
  const moveCell = await legalMove.getAttribute("data-reversi-cell");
  await legalMove.click();
  await expect(page.locator(`[data-reversi-cell="${moveCell}"]`)).toHaveAttribute("data-reversi-piece", "black");
  await page.getByRole("button", { name: /^席位 \d/ }).click();
  await expect(page.locator('[data-presence-state="connected"]').first()).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/reversi/${roomNo}$`));
  await page.getByRole("button", { name: /^席位 \d/ }).click();
  await expect(page.locator('[data-presence-state="connected"]').first()).toBeVisible();

  await page.goto(`${FRONTEND_BASE_URL}/entry/reversi/${roomNo}`);
  await expect(page).toHaveURL(new RegExp(`/reversi/${roomNo}$`));
  await expect(page.getByText(`房号 ${roomNo}`)).toBeVisible();
});
