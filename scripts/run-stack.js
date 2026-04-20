const { spawn } = require("child_process");
const path = require("path");

const mode = process.argv[2] === "start" ? "start" : "dev";
const rootDir = path.join(__dirname, "..");
const frontendPort = String(process.env.FRONTEND_PORT || "3100");
const backendPort = String(process.env.BACKEND_PORT || process.env.PORT || "3101");
const nextBin = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");

const sharedEnv = {
  ...process.env,
  FRONTEND_PORT: frontendPort,
  BACKEND_PORT: backendPort,
  PORT: backendPort,
  APP_URL: process.env.APP_URL || `http://127.0.0.1:${frontendPort}`,
  NODE_ENV: mode === "start" ? "production" : "development"
};

const backend = spawn(process.execPath, [path.join(rootDir, "backend", "server.js")], {
  cwd: rootDir,
  env: sharedEnv,
  stdio: "inherit"
});

const frontend = spawn(
  process.execPath,
  [nextBin, mode === "start" ? "start" : "dev", "-p", frontendPort],
  {
    cwd: rootDir,
    env: sharedEnv,
    stdio: "inherit"
  }
);

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  backend.kill("SIGTERM");
  frontend.kill("SIGTERM");
  process.exit(code);
}

backend.on("exit", (code) => shutdown(code || 0));
frontend.on("exit", (code) => shutdown(code || 0));

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
