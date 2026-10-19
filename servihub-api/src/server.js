import http from "node:http";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { createApp } from "./app.js";
import { isAiEnabled } from "./services/aiAnalysis.service.js";
import { initSockets } from "./sockets/index.js";

async function start() {
  await connectDB();

  const app = createApp();
  const httpServer = http.createServer(app);
  const io = initSockets(httpServer);

  httpServer.listen(env.PORT, () => {
    console.log(`servihub-api listening on port ${env.PORT} [${env.NODE_ENV}]`);
    if (env.DEMO_MODE) {
      console.log("DEMO_MODE is on: demo login and the customer simulator are enabled.");
    }
    console.log(
      isAiEnabled()
        ? `AI Copilot is on (Groq model ${env.GROQ_MODEL}). "npm run check:ai" tests the key and the model.`
        : "AI Copilot is off: GROQ_API_KEY is not set."
    );
  });

  let shuttingDown = false;
  async function shutdown(signal, exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down...`);

    // Give in-flight requests a moment, then force exit.
    const forceExit = setTimeout(() => process.exit(exitCode || 1), 10_000);
    forceExit.unref();

    io.close();
    httpServer.close(async () => {
      await mongoose.disconnect().catch(() => {});
      process.exit(exitCode);
    });
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (err) => {
    console.error("Unhandled rejection:", err);
    shutdown("unhandledRejection", 1);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
