const { COOKIE_NAME, signToken } = require("../../lib/auth");

const DEFAULT_ADMIN_SESSION = Object.freeze({
  id: 1,
  username: "admin",
  role: "admin",
  displayName: "系統管理員"
});

async function loginAsAdminSession(page, baseUrl) {
  await page.context().addCookies([
    {
      name: COOKIE_NAME,
      value: signToken(DEFAULT_ADMIN_SESSION),
      url: `${String(baseUrl || "").replace(/\/+$/, "")}/`,
      httpOnly: true,
      sameSite: "Lax"
    }
  ]);
}

function getAdminSessionCookie() {
  return `${COOKIE_NAME}=${signToken(DEFAULT_ADMIN_SESSION)}`;
}

module.exports = {
  getAdminSessionCookie,
  loginAsAdminSession
};
