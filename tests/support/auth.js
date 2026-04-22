const { expect } = require("playwright/test");

async function registerFreshUser(page, baseUrl, prefix = "smoke") {
  const uniqueId = `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 6)}`.toLowerCase();
  const credentials = {
    username: uniqueId,
    displayName: uniqueId.slice(0, 24),
    email: `${uniqueId}@example.test`,
    password: "Smoke123456"
  };

  await page.goto(`${baseUrl}/register`);
  await page.getByLabel("用戶名").fill(credentials.username);
  await page.getByLabel("顯示名稱").fill(credentials.displayName);
  await page.getByLabel("郵箱").fill(credentials.email);
  await page.getByLabel("密碼").fill(credentials.password);
  await page.getByRole("button", { name: "創建帳號" }).click();
  await expect(page).toHaveURL(`${baseUrl}/`);

  return credentials;
}

module.exports = {
  registerFreshUser
};
