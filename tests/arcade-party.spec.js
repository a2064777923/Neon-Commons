const { test, expect } = require("playwright/test");

test("arcade portal and party room creation smoke", async ({ page }) => {
  page.setDefaultTimeout(30000);

  await page.goto("http://127.0.0.1:3100/login");
  await page.getByLabel("帳號或郵箱").fill("admin");
  await page.getByLabel("密碼").fill("Admin123456");
  await page.getByRole("button", { name: "登入" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/");

  await expect(
    page.getByRole("heading", {
      name: "把斗地主、狼人杀、阿瓦隆、五子棋、跳棋装进一个入口里。"
    })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "进入游戏" }).nth(0)).toBeVisible();

  await page.goto("http://127.0.0.1:3100/games/werewolf");
  await expect(page.getByRole("heading", { name: "在线狼人杀", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /立即开/ }).click();
  await expect(page).toHaveURL(/\/party\/\d{6}$/);
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

  await page.goto("http://127.0.0.1:3100/games/avalon");
  await expect(page.getByRole("heading", { name: "在线阿瓦隆", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /立即开/ }).click();
  await expect(page).toHaveURL(/\/party\/\d{6}$/);
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
