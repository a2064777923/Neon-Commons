const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { initializeDatabase } = require("../lib/db");
const { registerSocketHandlers } = require("../lib/socket-server");
const { createRouter } = require("./router");

const port = Number(process.env.PORT || process.env.BACKEND_PORT || 3101);
const frontendPort = Number(process.env.FRONTEND_PORT || 3100);
const frontendOrigin =
  process.env.APP_URL || `http://127.0.0.1:${frontendPort}`;

const router = createRouter(path.join(__dirname, "handlers"));

start()
  .then(() => {
    console.log(
      `Neon Commons backend listening on ${port} with ${router.routes.length} API routes`
    );
  })
  .catch((error) => {
    console.error("Failed to start backend", error);
    process.exit(1);
  });

async function start() {
  await initializeDatabaseWithRetry();

  const server = http.createServer((req, res) => {
    applyCors(req, res);
    return router.handleRequest(req, res);
  });

  const io = new Server(server, {
    cors: {
      origin: frontendOrigin,
      credentials: true
    }
  });

  registerSocketHandlers(io);

  await new Promise((resolve) => {
    server.listen(port, "0.0.0.0", resolve);
  });
}

function applyCors(req, res) {
  const requestOrigin = req.headers.origin;
  const allowedOrigin =
    requestOrigin && requestOrigin === frontendOrigin ? requestOrigin : frontendOrigin;

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
}

async function initializeDatabaseWithRetry() {
  let attempt = 0;
  while (attempt < 15) {
    try {
      await initializeDatabase();
      return;
    } catch (error) {
      attempt += 1;
      if (attempt >= 15) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}
