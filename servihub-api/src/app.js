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

  app.use(helmet());

  app.use(
    cors({
      // A static string here (the previous config) still isn't exploitable
      // by a browser - the cors package would echo that fixed value back
      // on every response regardless of the request's actual Origin, and
      // browsers enforce CORS by checking the response's ACAO value
      // against their OWN origin, so a mismatched echoed value still gets
      // blocked client-side. But it means curl (which doesn't enforce
      // CORS at all) sees an ACAO header on every request including ones
      // from a disallowed origin, which reads as "not rejecting" even
      // though it's harmless. A callback makes the allow-list explicit and
      // means only a genuinely matching Origin ever gets the header back.
      origin(origin, callback) {
        // No Origin header at all (curl, server-to-server, health checks)
        // isn't a browser cross-origin request in the first place - CORS
        // doesn't apply, so let it through.
        if (!origin || origin === env.CLIENT_URL) {
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
