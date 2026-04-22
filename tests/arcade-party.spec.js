const { test, expect } = require("playwright/test");

const FRONTEND_BASE_URL = String(process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3100").replace(/\/+$/, "");

test("arcade portal and party room creation smoke", async ({ page }) => {
  page.setDefaultTimeout(30000);

  await page.goto(`${FRONTEND_BASE_URL}/login`);
  await page.getByLabel("帳號或郵箱").fill("admin");
  await page.getByLabel("密碼").fill("Admin123456");
  await page.getByRole("button", { name: "登入" }).click();
  await expect(page).toHaveURL(`${FRONTEND_BASE_URL}/`);

  await expect(page.getByRole("heading", { name: "遊戲入口", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "遊戲家族", exact: true })).toBeVisible();

  await page.goto(`${FRONTEND_BASE_URL}/games/werewolf`);
  await expect(page.getByRole("heading", { name: "在线狼人杀", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "返回遊戲家族" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "複製邀請" }).first()).toBeVisible();
  await page.getByLabel("角色預設").selectOption("casual");
  await page.getByLabel("房内沟通").selectOption("text");
  await page.getByLabel("猎人反击秒数").fill("25");
  await expect(page.locator('[data-party-role-pack="selected"]')).toContainText("輕量局");
  await expect(page.locator('[data-party-role-pack="selected"]')).toContainText("文字房");
  await expect(page.locator('[data-party-role-pack="selected"]')).toContainText("村民 x3");
  await page.getByRole("button", { name: /立即开/ }).click();
  await expect(page).toHaveURL(/\/party\/\d{6}$/);
  await expect(page.locator('[data-party-config="true"]')).toContainText("輕量局");
  await expect(page.locator('[data-party-config="true"]')).toContainText("文字房");
  await expect(page.locator('[data-party-config="true"]')).toContainText("猎人反击 25s");
  await expect(page.locator('[data-party-config="true"]')).toContainText("村民 x3");
  await expect(page.getByRole("button", { name: "接通语音" })).toBeVisible();
  await expect(page.getByRole("button", { name: "准备开局" })).toBeVisible();
  await page.getByRole("button", { name: "准备开局" }).click();
  for (let count = 0; count < 5; count += 1) {
    await page.getByRole("button", { name: "补机器人" }).click();
  }
  await expect(page.getByText("对局进行中")).toBeVisible();
  await expect(
    page.getByText(/夜色已落，神职与狼人开始行动|天亮发言，打开语音互相试探|公开投票阶段|猎人翻枪，局势正在瞬间改写/)
  ).toBeVisible();

  await page.goto(`${FRONTEND_BASE_URL}/games/avalon`);
  await expect(page.getByRole("heading", { name: "在线阿瓦隆", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "返回遊戲家族" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "複製邀請" }).first()).toBeVisible();
  await page.getByLabel("人数上限").fill("8");
  await page.getByLabel("角色預設").selectOption("classic");
  await page.getByLabel("房内沟通").selectOption("text");
  await expect(page.locator('[data-party-role-pack="selected"]')).toContainText("經典局");
  await expect(page.locator('[data-party-role-pack="selected"]')).toContainText("爪牙");
  await expect(page.locator('[data-party-role-pack="selected"]')).toContainText("文字房");
  await page.getByRole("button", { name: /立即开/ }).click();
  await expect(page).toHaveURL(/\/party\/\d{6}$/);
  await expect(page.locator('[data-party-config="true"]')).toContainText("經典局");
  await expect(page.locator('[data-party-config="true"]')).toContainText("爪牙");
  await expect(page.locator('[data-party-config="true"]')).toContainText("文字房");
  await expect(page.getByRole("button", { name: "接通语音" })).toBeVisible();
  await expect(page.getByRole("button", { name: "准备开局" })).toBeVisible();
  await page.getByRole("button", { name: "准备开局" }).click();
  for (let count = 0; count < 4; count += 1) {
    await page.getByRole("button", { name: "补机器人" }).click();
  }
  await expect(page.getByText("对局进行中")).toBeVisible();
  await expect(
    page.getByText(/队长正在组队|全员表决当前小队|任务成员暗投任务牌|刺客锁定梅林/)
  ).toBeVisible();
});
