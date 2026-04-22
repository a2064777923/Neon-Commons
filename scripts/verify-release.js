const { spawn } = require("child_process");

const DEFAULT_FRONTEND_BASE_URL = "http://127.0.0.1:3100";
const DEFAULT_BACKEND_BASE_URL = "http://127.0.0.1:3101";
const READY_TIMEOUT_MS = Number(process.env.RELEASE_READY_TIMEOUT_MS || 90000);
const READY_INTERVAL_MS = 1000;

const args = process.argv.slice(2);
const command = args[0] === "deploy" ? "deploy" : "verify";
const skipDeploy = args.includes("--skip-deploy");
const frontendBaseUrl = normalizeBaseUrl(
  process.env.FRONTEND_BASE_URL || process.env.RELEASE_FRONTEND_BASE_URL || DEFAULT_FRONTEND_BASE_URL
);
const backendBaseUrl = normalizeBaseUrl(
  process.env.BACKEND_BASE_URL || process.env.RELEASE_BACKEND_BASE_URL || DEFAULT_BACKEND_BASE_URL
);

main().catch((error) => {
  console.error(`[release] ${error.message}`);
  process.exit(1);
});

async function main() {
  if (command === "deploy") {
    await redeployCanonicalStack();
    await waitForRuntimeReadiness();
    return;
  }

  if (!skipDeploy) {
    await redeployCanonicalStack();
  } else {
    logStage("Skipping redeploy", "using the current 3100/3101 stack");
  }

  await waitForRuntimeReadiness();
  await runStage({
    title: "Running structural check",
    detail: "npm run check",
    rerun: "npm run check",
    run: () => runChecked(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "check"])
  });
  await runStage({
    title: "Running live-ops and recovery logic gate",
    detail: "npm run test:logic:critical",
    rerun: "npm run test:logic:liveops",
    run: () =>
      runChecked(process.platform === "win32" ? "npm.cmd" : "npm", [
        "run",
        "test:logic:critical"
      ])
  });
  await runStage({
    title: "Running live-ops and recovery UI gate",
    detail: `FRONTEND_BASE_URL=${frontendBaseUrl} npm run test:ui:critical`,
    rerun: `FRONTEND_BASE_URL=${frontendBaseUrl} npm run test:ui:liveops`,
    run: () =>
      runChecked(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "test:ui:critical"], {
        env: {
          ...process.env,
          FRONTEND_BASE_URL: frontendBaseUrl
        }
      })
  });
  logStage("Release verification passed", "all critical checks are green");
}

async function redeployCanonicalStack() {
  logStage("Redeploying canonical stack", "docker compose up -d --build app");
  await runChecked("docker", ["compose", "up", "-d", "--build", "app"]);
}

async function waitForRuntimeReadiness() {
  logStage("Waiting for readiness", `${frontendBaseUrl} and ${backendBaseUrl}`);

  const deadline = Date.now() + READY_TIMEOUT_MS;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      await Promise.all([
        assertUrlReady(`${frontendBaseUrl}/login`, "text/html"),
        assertUrlReady(`${backendBaseUrl}/api/hub`, "application/json")
      ]);
      logStage("Runtime ready", "frontend and backend responded successfully");
      return;
    } catch (error) {
      lastError = error;
      await sleep(READY_INTERVAL_MS);
    }
  }

  throw new Error(
    `Timed out waiting for canonical runtime readiness after ${Math.round(
      READY_TIMEOUT_MS / 1000
    )}s${lastError ? `: ${lastError.message}` : ""}`
  );
}

async function assertUrlReady(url, expectedContentType) {
  const response = await fetch(url, {
    redirect: "manual"
  });

  if (!response.ok) {
    throw new Error(`${url} responded with ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (expectedContentType && !contentType.includes(expectedContentType)) {
    throw new Error(`${url} responded with unexpected content type: ${contentType || "unknown"}`);
  }
}

async function runStage({ title, detail, rerun, run }) {
  logStage(title, detail);

  try {
    await run();
  } catch (error) {
    throw new Error(`${title} failed. Rerun: ${rerun}. Root error: ${error.message}`);
  }
}

function runChecked(commandName, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandName, commandArgs, {
      cwd: process.cwd(),
      env: options.env || process.env,
      stdio: "inherit"
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      if (signal) {
        reject(new Error(`${commandName} ${commandArgs.join(" ")} terminated with ${signal}`));
        return;
      }

      reject(new Error(`${commandName} ${commandArgs.join(" ")} exited with code ${code}`));
    });
  });
}

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function logStage(title, detail) {
  console.log(`[release] ${title}${detail ? `: ${detail}` : ""}`);
}

function sleep(durationMs) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}
