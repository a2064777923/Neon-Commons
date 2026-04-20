const { test, expect } = require("playwright/test");

test("gomoku and chinese checkers board rooms smoke", async ({ page }) => {
  page.setDefaultTimeout(30000);

  await page.goto("http://127.0.0.1:3100/login");
  await page.getByLabel("帳號或郵箱").fill("admin");
  await page.getByLabel("密碼").fill("Admin123456");
  await page.getByRole("button", { name: "登入" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/");

  await page.goto("http://127.0.0.1:3100/games/gomoku");
  await expect(page.getByRole("heading", { name: "在线五子棋", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /立即开/ }).click();
  await expect(page).toHaveURL(/\/board\/\d{6}$/);
  await page.getByRole("button", { name: "准备开局" }).click();
  await page.getByRole("button", { name: "补机器人" }).click();
  await page.waitForSelector('[data-gomoku-cell="7-7"]');
  await page.locator('[data-gomoku-cell="7-7"]').click();
  await expect(page.locator('[data-gomoku-cell="7-7"][data-gomoku-piece="black"]')).toBeVisible();

  await page.goto("http://127.0.0.1:3100/games/chinesecheckers");
  await expect(page.getByRole("heading", { name: "在线跳棋", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /立即开/ }).click();
  await expect(page).toHaveURL(/\/board\/\d{6}$/);
  await page.getByRole("button", { name: "准备开局" }).click();
  await page.getByRole("button", { name: "补机器人" }).click();
  await page.waitForSelector('[data-jump-movable="true"]');
  await page.locator('[data-jump-movable="true"]').first().click();
  await page.waitForSelector('[data-jump-target="true"]');
  const target = page.locator('[data-jump-target="true"]').first();
  const targetCellId = await target.getAttribute("data-jump-cell");
  await target.click();
  await expect
    .poll(async () =>
      await page.locator(`[data-jump-cell="${targetCellId}"]`).getAttribute("data-jump-occupant")
    )
    .toBe("0");
});
