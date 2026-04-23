const { expect } = require("playwright/test");

async function waitForPartyRoomReady(page, roomNo, timeout = 30000) {
  await waitForRoomTag(page, `房号 ${roomNo}`, timeout);
  await expect(page.getByText("正在同步房间状态...", { exact: true })).toHaveCount(0, {
    timeout
  });
}

async function waitForBoardRoomReady(page, roomNo, timeout = 30000) {
  await waitForRoomTag(page, `房号 ${roomNo}`, timeout);
  await expect(page.getByText("正在同步棋盘房间状态...", { exact: true })).toHaveCount(0, {
    timeout
  });
}

async function waitForUndercoverRoomReady(page, roomNo, timeout = 30000) {
  await waitForRoomTag(page, `房號 ${roomNo}`, timeout);
  await expect(page.getByText("正在同步誰是臥底房間狀態...", { exact: true })).toHaveCount(0, {
    timeout
  });
}

async function waitForConnectedPresence(page, timeout = 30000) {
  await expect(page.locator('[data-presence-state="connected"]').first()).toBeVisible({
    timeout
  });
}

async function waitForRoomTag(page, roomTag, timeout = 30000) {
  await expect(page.getByText(roomTag, { exact: true }).first()).toBeVisible({ timeout });
}

module.exports = {
  waitForBoardRoomReady,
  waitForConnectedPresence,
  waitForPartyRoomReady,
  waitForRoomTag,
  waitForUndercoverRoomReady
};
