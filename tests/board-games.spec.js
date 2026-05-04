const { test, expect } = require("playwright/test");
const { API_ROUTES } = require("../lib/client/network-runtime");
const { registerFreshUserSession } = require("./support/auth");
const { adminBackendJson } = require("./support/admin-backend");
const { waitForBoardRoomReady, waitForConnectedPresence } = require("./support/room-sync");

const FRONTEND_BASE_URL = String(process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3100").replace(/\/+$/, "");
const BACKEND_BASE_URL = FRONTEND_BASE_URL.replace(/:3100$/, ":3101");

test("gomoku, chinese checkers, and flying chess board rooms smoke", async ({ browser, page }) => {
  test.slow();
  test.setTimeout(180000);
  page.setDefaultTimeout(30000);
  let gomokuRoomNo = "";
  let chineseCheckersRoomNo = "";
  let flyingChessRoomNo = "";
  let flyingChessGuestContext = null;
  let flyingChessGuestPage = null;

  await registerFreshUserSession(page, FRONTEND_BASE_URL, "boardsmoke");

  try {
    await expect(page.getByRole("heading", { name: "遊戲入口", exact: true })).toBeVisible();

    await page.goto(`${FRONTEND_BASE_URL}/games/gomoku`);
    await expect(page.getByRole("heading", { name: "在线五子棋", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "返回遊戲家族" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "複製邀請" }).first()).toBeVisible();
    await page.getByLabel("开局规则").selectOption("center-opening");
    await page.getByRole("button", { name: /立即开/ }).click();
    await expect(page).toHaveURL(/\/board\/\d{6}$/, { timeout: 15000 });
    gomokuRoomNo = page.url().match(/\/board\/(\d{6})$/)[1];
    await waitForBoardRoomReady(page, gomokuRoomNo);
    await expect(page.locator('[data-board-chip="天元开局"]').first()).toBeVisible();
    await expect(page.getByRole("button", { name: "准备开局" })).toBeEnabled();
    await page.getByRole("button", { name: "准备开局" }).click();
    await expect(page.getByRole("button", { name: "补机器人" })).toBeEnabled();
    await page.getByRole("button", { name: "补机器人" }).click();
    await expect(page.locator('[data-gomoku-cell="7-7"]')).toBeEnabled();
    await page.getByRole("button", { name: /^席位 \d/ }).click();
    await waitForConnectedPresence(page);
    await page.getByRole("button", { name: "关闭" }).click();
    await page.locator('[data-gomoku-cell="0-0"]').click();
    await expect(page.locator('[data-gomoku-cell="0-0"][data-gomoku-piece="empty"]')).toBeVisible();
    await page.locator('[data-gomoku-cell="7-7"]').click();
    await expect(page.locator('[data-gomoku-cell="7-7"][data-gomoku-piece="black"]')).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/board/${gomokuRoomNo}$`));
    await waitForBoardRoomReady(page, gomokuRoomNo);
    await page.getByRole("button", { name: /^席位 \d/ }).click();
    await waitForConnectedPresence(page);
    await page.getByRole("button", { name: "关闭" }).click();

    await page.goto(`${FRONTEND_BASE_URL}/games/chinesecheckers`);
    await expect(page.getByRole("heading", { name: "在线跳棋", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "返回遊戲家族" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "複製邀請" }).first()).toBeVisible();
    await page.getByRole("button", { name: /立即开/ }).click();
    await expect(page).toHaveURL(/\/board\/\d{6}$/, { timeout: 15000 });
    chineseCheckersRoomNo = page.url().match(/\/board\/(\d{6})$/)[1];
    await waitForBoardRoomReady(page, chineseCheckersRoomNo);
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

    await page.goto(`${FRONTEND_BASE_URL}/games/flyingchess`);
    await expect(page.getByRole("heading", { name: "飛行棋", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "返回遊戲家族" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "複製邀請" }).first()).toBeVisible();
    await page.getByLabel("人数上限").selectOption("2");
    await page.getByRole("button", { name: /立即开/ }).click();
    await expect(page).toHaveURL(/\/board\/\d{6}$/, { timeout: 15000 });
    flyingChessRoomNo = page.url().match(/\/board\/(\d{6})$/)[1];
    await waitForBoardRoomReady(page, flyingChessRoomNo);
    await expect(page.getByRole("button", { name: "准备开局" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "补机器人" })).toHaveCount(0);
    await expect(page.getByText("飞行棋暂不支持 AI 补位")).toBeVisible();

    flyingChessGuestContext = await browser.newContext();
    flyingChessGuestPage = await flyingChessGuestContext.newPage();
    flyingChessGuestPage.setDefaultTimeout(30000);
    await registerFreshUserSession(flyingChessGuestPage, FRONTEND_BASE_URL, "flyingguest");
    await flyingChessGuestPage.goto(`${FRONTEND_BASE_URL}/entry/flyingchess/${flyingChessRoomNo}`);
    await expect(flyingChessGuestPage).toHaveURL(new RegExp(`/board/${flyingChessRoomNo}$`), {
      timeout: 45000
    }).catch(async () => {
      const retryButton = flyingChessGuestPage.locator('[data-entry-action="retry"]');
      if (await retryButton.count() > 0) {
        await retryButton.click();
        await expect(flyingChessGuestPage).toHaveURL(new RegExp(`/board/${flyingChessRoomNo}$`), {
          timeout: 30000
        });
      } else {
        throw new Error("entry page did not redirect and no retry button found");
      }
    });
    await waitForBoardRoomReady(flyingChessGuestPage, flyingChessRoomNo);

    await page.getByRole("button", { name: "准备开局" }).click();
    await flyingChessGuestPage.getByRole("button", { name: "准备开局" }).click();
    await expect(page.locator('[data-flyingchess-board="true"]')).toBeVisible();
    await expect(page.locator('[data-flyingchess-phase]').first()).toBeVisible();
    await expect(page.locator('[data-flyingchess-progress]').first()).toBeVisible();
    await playFlyingChessUntilMove(page, flyingChessGuestPage);
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/board/${flyingChessRoomNo}$`));
    await waitForBoardRoomReady(page, flyingChessRoomNo);
    await expect(page.locator('[data-flyingchess-board="true"]')).toBeVisible();
  } finally {
    if (flyingChessGuestContext) {
      await flyingChessGuestContext.close().catch(() => {});
    }
    if (flyingChessRoomNo) {
      await closeAdminLiveRoom(flyingChessRoomNo).catch(() => {});
    }
    if (chineseCheckersRoomNo) {
      await closeAdminLiveRoom(chineseCheckersRoomNo).catch(() => {});
    }
    if (gomokuRoomNo) {
      await closeAdminLiveRoom(gomokuRoomNo).catch(() => {});
    }
  }
});

async function playFlyingChessUntilMove(ownerPage, guestPage, maxAttempts = 24) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const activePage = await waitForActiveFlyingChessRollPage(ownerPage, guestPage);
    if (!activePage) {
      throw new Error("no active flying chess player page found");
    }

    await activePage.locator('[data-flyingchess-roll="ready"]').first().click();
    await activePage.waitForTimeout(800);
    const movablePieces = activePage.locator('[data-flyingchess-piece][data-piece-movable="true"]');
    const movableCount = await movablePieces.count();
    if (movableCount === 0) {
      continue;
    }

    const piece = movablePieces.first();
    const pieceId = await piece.getAttribute("data-flyingchess-piece");
    await piece.click();
    const target = activePage.locator('[data-flyingchess-target]').first();
    await expect(target).toBeVisible({ timeout: 5000 });
    const targetCellId = await target.getAttribute("data-flyingchess-target");
    await target.click();
    await expect(activePage.locator(`[data-flyingchess-piece="${pieceId}"]`)).toHaveAttribute(
      "data-piece-zone",
      "ring"
    );
    await expect(activePage.locator(`[data-flyingchess-cell="${targetCellId}"]`)).toBeVisible();
    return;
  }

  throw new Error("flying chess smoke did not reach a movable turn");
}

async function waitForActiveFlyingChessRollPage(...pages) {
  const startedAt = Date.now();
  const timeoutMs = 8000;

  while (Date.now() - startedAt < timeoutMs) {
    for (const page of pages) {
      if (!page) {
        continue;
      }

      const readyRoll = page.locator('[data-flyingchess-roll="ready"]').first();
      if ((await readyRoll.count()) === 0) {
        continue;
      }
      if (!(await readyRoll.isEnabled().catch(() => false))) {
        continue;
      }
      return page;
    }

    await pages.find(Boolean)?.waitForTimeout(150);
  }

  return null;
}

async function closeAdminLiveRoom(roomNo) {
  return adminBackendJson(`${BACKEND_BASE_URL}${API_ROUTES.admin.liveRooms.action(roomNo)}`, {
    method: "POST",
    data: {
      action: "close"
    },
    timeout: 12000,
    attempts: 1
  });
}
