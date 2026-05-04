const { test, expect } = require("playwright/test");

const FRONTEND_BASE_URL = String(process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3100").replace(/\/+$/, "");

test("mahjong room page loads without crash", async ({ page }) => {
  page.setDefaultTimeout(15000);

  const response = await page.goto(`${FRONTEND_BASE_URL}/games/mahjong`);
  expect(response.status()).toBeLessThan(500);
  await expect(page).toHaveURL(/mahjong/);
});

test("mahjong game card is visible on hub page", async ({ page }) => {
  page.setDefaultTimeout(15000);

  await page.goto(`${FRONTEND_BASE_URL}/`);
  const mahjongCard = page.getByText("麻將").first();
  await expect(mahjongCard).toBeVisible({ timeout: 10000 });
});
