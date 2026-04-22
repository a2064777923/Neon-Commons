const { test, expect } = require("playwright/test");
const { registerFreshUser } = require("./support/auth");

const FRONTEND_BASE_URL = String(process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3100").replace(/\/+$/, "");

test("gomoku and chinese checkers board rooms smoke", async ({ page }) => {
  page.setDefaultTimeout(30000);

  await registerFreshUser(page, FRONTEND_BASE_URL, "boardsmoke");

  await expect(page.getByRole("heading", { name: "遊戲入口", exact: true })).toBeVisible();

  await page.goto(`${FRONTEND_BASE_URL}/games/gomoku`);
  await expect(page.getByRole("heading", { name: "在线五子棋", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "返回遊戲家族" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "複製邀請" }).first()).toBeVisible();
  await page.getByLabel("开局规则").selectOption("center-opening");
  await page.getByRole("button", { name: /立即开/ }).click();
  await expect(page).toHaveURL(/\/board\/\d{6}$/);
  await expect(page.locator('[data-board-chip="天元开局"]').first()).toBeVisible();
  await expect(page.getByRole("button", { name: "准备开局" })).toBeEnabled();
  await page.getByRole("button", { name: "准备开局" }).click();
  await expect(page.getByRole("button", { name: "补机器人" })).toBeEnabled();
  await page.getByRole("button", { name: "补机器人" }).click();
  await expect(page.locator('[data-gomoku-cell="7-7"]')).toBeEnabled();
  await page.getByRole("button", { name: /^席位 \d/ }).click();
  await expect(page.locator('[data-presence-state="connected"]').first()).toBeVisible();
  await page.getByRole("button", { name: "关闭" }).click();
  await page.locator('[data-gomoku-cell="0-0"]').click();
  await expect(page.locator('[data-gomoku-cell="0-0"][data-gomoku-piece="empty"]')).toBeVisible();
  await page.locator('[data-gomoku-cell="7-7"]').click();
  await expect(page.locator('[data-gomoku-cell="7-7"][data-gomoku-piece="black"]')).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/board\/\d{6}$/);
  await page.getByRole("button", { name: /^席位 \d/ }).click();
  await expect(page.locator('[data-presence-state="connected"]').first()).toBeVisible();
  await page.getByRole("button", { name: "关闭" }).click();

  await page.goto(`${FRONTEND_BASE_URL}/games/chinesecheckers`);
  await expect(page.getByRole("heading", { name: "在线跳棋", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "返回遊戲家族" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "複製邀請" }).first()).toBeVisible();
  await page.getByRole("button", { name: /立即开/ }).click();
  await expect(page).toHaveURL(/\/board\/\d{6}$/);
  await expect(page.getByRole("button", { name: "准备开局" })).toBeEnabled();
  await page.getByRole("button", { name: "准备开局" }).click();
  await expect(page.getByRole("button", { name: "补机器人" })).toBeEnabled();
  await page.getByRole("button", { name: "补机器人" }).click();
  await expect(page.locator('[data-progress-seat="0"]').first()).toBeVisible();
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
  await expect(page.locator('[data-progress-seat="0"]').first()).toHaveAttribute("data-progress-value", /[0-9]+\/10/);
});
