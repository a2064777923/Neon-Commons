const { test, expect } = require("playwright/test");

const FRONTEND_BASE_URL = String(process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3100").replace(/\/+$/, "");

test("sokoban direct-launch route works without room flow", async ({ page }) => {
  page.setDefaultTimeout(30000);

  await page.goto(`${FRONTEND_BASE_URL}/games/sokoban`);
  await expect(page.getByRole("heading", { name: "推箱子", exact: true })).toBeVisible();
  await expect(page.getByText("直接開始，不需房號", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "重開本關" })).toBeVisible();
  await expect(page.getByRole("button", { name: "下一關" })).toBeVisible();

  await expect(page.locator("[data-sokoban-level]")).toHaveText("入門推進");
  await expect(page.locator("[data-sokoban-moves]")).toHaveText("0");

  await page.keyboard.press("ArrowUp");
  await expect(page.locator("[data-sokoban-moves]")).toHaveText("1");
  await expect(page.locator("[data-sokoban-status='solved']")).toBeVisible();

  await page.getByRole("button", { name: "重開本關" }).click();
  await expect(page.locator("[data-sokoban-moves]")).toHaveText("0");
  await expect(page.locator("[data-sokoban-status='active']")).toBeVisible();

  await page.getByRole("button", { name: "下一關" }).click();
  await expect(page.locator("[data-sokoban-level]")).toHaveText("轉角熱身");
});
