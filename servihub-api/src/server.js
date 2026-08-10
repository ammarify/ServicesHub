import http from "node:http";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { createApp } from "./app.js";
import { initSockets } from "./sockets/index.js";

async function start() {
  await connectDB();

  const app = createApp();
  const httpServer = http.createServer(app);
  initSockets(httpServer);

  httpServer.listen(env.PORT, () => {
    console.log(`servihub-api listening on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  process.on("unhandledRejection", (err) => {
    console.error("Unhandled rejection:", err);
    httpServer.close(() => process.exit(1));
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
