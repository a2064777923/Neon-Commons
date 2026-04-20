const fs = require("fs");
const path = require("path");

const required = [
  "package.json",
  "backend/server.js",
  "backend/handlers/auth/login.js",
  "pages/index.js",
  "pages/lobby.js",
  "pages/room/[roomNo].js",
  "pages/admin/index.js",
  "lib/db.js",
  "lib/client/api.js",
  "lib/game/room-manager.js",
  "docker-compose.yml",
  "docs/overview/project-overview.md"
];

const missing = required.filter((item) => !fs.existsSync(path.join(process.cwd(), item)));

if (missing.length > 0) {
  console.error("Missing required files:\n" + missing.join("\n"));
  process.exit(1);
}

console.log("Project structure check passed.");
