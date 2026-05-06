const { test, expect } = require("playwright/test");

const FRONTEND_BASE_URL = String(process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3100").replace(/\/+$/, "");

test("bigtwo room page loads without crashing", async ({ page }) => {
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

  // Mock bigtwo room detail API
  await page.route("**/api/bigtwo/rooms/*", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          room: {
            roomNo: "test-room",
            gameKey: "bigtwo",
            familyKey: "card",
            state: "waiting",
            config: { maxPlayers: 4 },
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

  await page.goto(`${FRONTEND_BASE_URL}/bigtwo/test-room`);
  await page.waitForLoadState("networkidle");

  // Page should not show a crash error
  const body = await page.textContent("body");
  expect(body).not.toMatch(/application error/i);
  expect(body).not.toMatch(/500/i);
});

// Hub card test omitted: bigtwo has isShipped=false in catalog, so it does not appear on the hub page.
