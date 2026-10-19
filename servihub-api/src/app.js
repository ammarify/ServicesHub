import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { ApiError } from "./utils/ApiError.js";
import { apiLimiter } from "./middleware/rateLimiters.js";
import { sanitizeInput } from "./middleware/sanitizeInput.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import healthRoutes from "./routes/health.routes.js";
import configRoutes from "./routes/config.routes.js";
import authRoutes from "./routes/auth.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import providerRoutes from "./routes/provider.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import ticketRoutes from "./routes/ticket.routes.js";
import refundRoutes from "./routes/refund.routes.js";
import searchRoutes from "./routes/search.routes.js";
import teamRoutes from "./routes/team.routes.js";

export function createApp() {
  const app = express();

  // Behind a reverse proxy (Render, Railway, nginx...) this makes req.ip the
  // real client address, which rate limiting depends on.
  app.set("trust proxy", env.TRUST_PROXY);
  app.disable("x-powered-by");

  app.use(helmet());

  app.use(
    cors({
      // An explicit allow-list: only a matching Origin gets
      // Access-Control-Allow-Origin back. Requests without an Origin header
      // (curl, server-to-server, health checks) aren't cross-origin browser
      // requests, so CORS doesn't apply to them.
      origin(origin, callback) {
        if (!origin || env.CLIENT_URL.includes(origin)) {
          return callback(null, true);
        }
        callback(new ApiError(403, "Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE"],
    })
  );

  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(sanitizeInput);
  app.use(apiLimiter);

  app.use("/api/health", healthRoutes);
  app.use("/api/config", configRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/bookings", bookingRoutes);
  app.use("/api/providers", providerRoutes);
  app.use("/api/customers", customerRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/tickets", ticketRoutes);
  app.use("/api/refunds", refundRoutes);
  app.use("/api/search", searchRoutes);
  app.use("/api/team", teamRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
