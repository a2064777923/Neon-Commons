const { test, expect } = require("playwright/test");

const FRONTEND_BASE_URL = String(process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3100").replace(/\/+$/, "");

test("undercover dedicated room route supports one clue and vote loop", async ({ page }) => {
  page.setDefaultTimeout(30000);

  await page.goto(`${FRONTEND_BASE_URL}/login`);
  await page.getByLabel("帳號或郵箱").fill("admin");
  await page.getByLabel("密碼").fill("Admin123456");
  await page.getByRole("button", { name: "登入" }).click();
  await expect(page).toHaveURL(`${FRONTEND_BASE_URL}/`);

  await page.goto(`${FRONTEND_BASE_URL}/games/undercover`);
  await expect(page.getByRole("heading", { name: "誰是臥底", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /立即开/ }).click();
  await expect(page).toHaveURL(/\/undercover\/\d{6}$/);

  const roomNo = page.url().match(/\/undercover\/(\d{6})$/)[1];
  await page.getByRole("button", { name: "準備開局" }).click();
  for (let count = 0; count < 3; count += 1) {
    await page.getByRole("button", { name: "補機器人" }).click();
  }

  await expect(page.locator("[data-undercover-word]")).not.toHaveText("等待發詞");
  await page.getByRole("textbox").fill("這個詞跟日常很有關");
  await page.getByRole("button", { name: "提交描述" }).click();

  await expect(page.getByText("公開投票階段")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: /^投給 / }).first()).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: /^投給 / }).first().click();
  await expect(page).toHaveURL(new RegExp(`/undercover/${roomNo}$`));
  await expect(page.getByText(`房號 ${roomNo}`)).toBeVisible();
});
