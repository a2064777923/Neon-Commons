const { test, expect } = require("playwright/test");

const FRONTEND_BASE_URL = String(process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3100").replace(/\/+$/, "");

test("racing room page loads without crashing", async ({ page }) => {
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

  // Mock racing room detail API
  await page.route("**/api/racing/rooms/*", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          room: {
            roomNo: "test-room",
            gameKey: "racing",
            familyKey: "light-3d",
            state: "waiting",
            config: { maxPlayers: 4, laps: 3 },
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

  await page.goto(`${FRONTEND_BASE_URL}/racing/test-room`);
  await page.waitForLoadState("networkidle");

  // Page should not show a crash error
  const body = await page.textContent("body");
  expect(body).not.toMatch(/application error/i);
  expect(body).not.toMatch(/500/i);
});

test("racing room page shows 3D canvas", async ({ page }) => {
  test.slow();
  page.setDefaultTimeout(30000);

  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "test-user-1", displayName: "TestPlayer" },
        session: { id: "test-user-1", kind: "user", displayName: "TestPlayer" }
      })
    });
  });

  await page.route("**/api/racing/rooms/*", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          room: {
            roomNo: "test-room",
            gameKey: "racing",
            familyKey: "light-3d",
            state: "waiting",
            config: { maxPlayers: 4, laps: 3 },
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

  await page.goto(`${FRONTEND_BASE_URL}/racing/test-room`);
  await page.waitForLoadState("networkidle");

  // Wait for canvas element (Three.js WebGLRenderer creates a canvas)
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 10000 });
});

test("racing room page shows HUD elements", async ({ page }) => {
  test.slow();
  page.setDefaultTimeout(30000);

  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "test-user-1", displayName: "TestPlayer" },
        session: { id: "test-user-1", kind: "user", displayName: "TestPlayer" }
      })
    });
  });

  await page.route("**/api/racing/rooms/*", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          room: {
            roomNo: "test-room",
            gameKey: "racing",
            familyKey: "light-3d",
            state: "waiting",
            config: { maxPlayers: 4, laps: 3 },
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

  await page.goto(`${FRONTEND_BASE_URL}/racing/test-room`);
  await page.waitForLoadState("networkidle");

  // Check for HUD elements (lap counter, room number)
  await expect(page.locator("text=Lap")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("text=Room test-room")).toBeVisible({ timeout: 5000 });
});

test("racing room page shows ready button in waiting state", async ({ page }) => {
  test.slow();
  page.setDefaultTimeout(30000);

  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "test-user-1", displayName: "TestPlayer" },
        session: { id: "test-user-1", kind: "user", displayName: "TestPlayer" }
      })
    });
  });

  await page.route("**/api/racing/rooms/*", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          room: {
            roomNo: "test-room",
            gameKey: "racing",
            familyKey: "light-3d",
            state: "waiting",
            config: { maxPlayers: 4, laps: 3 },
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

  await page.goto(`${FRONTEND_BASE_URL}/racing/test-room`);
  await page.waitForLoadState("networkidle");

  // Check for ready overlay and button
  await expect(page.locator("text=Ready")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("text=Racing")).toBeVisible({ timeout: 5000 });
});
