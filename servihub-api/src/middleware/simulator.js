import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { verifySimulatorToken } from "../utils/jwt.js";

export const SIMULATOR_TOKEN_HEADER = "x-simulator-token";

// The customer simulator is a demo harness. Outside DEMO_MODE its routes
// behave as if they didn't exist.
export function requireDemoMode(req, res, next) {
  if (!env.DEMO_MODE) {
    return next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
  }
  next();
}

// Requires the per-ticket token handed out by POST /tickets or
// POST /tickets/simulator/session, and that it belongs to :id.
export function requireSimulatorToken(req, res, next) {
  const token = req.get(SIMULATOR_TOKEN_HEADER);
  if (!token) {
    return next(new ApiError(401, "This chat link has expired. Start over.", "SIMULATOR_TOKEN_REQUIRED"));
  }

  try {
    const claims = verifySimulatorToken(token);
    if (claims.ticketId !== req.params.id) throw new Error("ticket mismatch");
    req.simulator = claims;
    next();
  } catch {
    next(new ApiError(401, "This chat link has expired. Start over.", "SIMULATOR_TOKEN_INVALID"));
  }
}
