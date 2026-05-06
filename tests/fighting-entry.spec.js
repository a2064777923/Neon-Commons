const { test, expect } = require("playwright/test");

const FRONTEND_BASE_URL = String(process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3100").replace(/\/+$/, "");

test("fighting room page loads without crashing", async ({ page }) => {
  test.slow();
  page.setDefaultTimeout(30000);

  // Mock /api/me to return a logged-in user
  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "test-user-1", displayName: "TestPlayer" },
        session: { id: "test-user-1", kind: "user", displayName: "TestPlayer" }
      })
    });
  });

  // Mock fighting room detail API
  await page.route("**/api/fighting/rooms/*", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          room: {
            roomNo: "test-room",
            gameKey: "fighting",
            familyKey: "light-3d",
            state: "waiting",
            config: { maxPlayers: 2, roundCount: 3 },
            players: [
              { userId: "test-user-1", seatIndex: 0, displayName: "TestPlayer", ready: false }
            ],
            viewer: { seatIndex: 0, displayName: "TestPlayer", ready: false }
          }
        })
      });
    } else {
      await route.continue();
    }
  });

  await page.goto(`${FRONTEND_BASE_URL}/fighting/test-room`);
  await page.waitForLoadState("networkidle");

  // Page should not show a crash error
  const body = await page.textContent("body");
  expect(body).not.toMatch(/application error/i);
  expect(body).not.toMatch(/500/i);
});

test("fighting game card is visible on hub page", async ({ page }) => {
  page.setDefaultTimeout(15000);

  await page.goto(`${FRONTEND_BASE_URL}/`);
  const card = page.getByText("打斗").first();
  await expect(card).toBeVisible({ timeout: 10000 });
});
