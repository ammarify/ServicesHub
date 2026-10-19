import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { env } from "../config/env.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { ACCESS_COOKIE } from "../utils/cookies.js";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const common = {
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.DISABLE_RATE_LIMITS,
};

const rateLimitIdentity = new WeakMap();

function signedInUserId(req) {
  if (rateLimitIdentity.has(req)) return rateLimitIdentity.get(req);

  let userId = null;
  const token = req.cookies?.[ACCESS_COOKIE];
  if (token) {
    try {
      // Signature only (no DB): good enough to bucket requests per user.
      userId = verifyAccessToken(token, { ignoreExpiration: true }).userId ?? null;
    } catch {
      userId = null;
    }
  }
  rateLimitIdentity.set(req, userId);
  return userId;
}

// Global limiter. Signed-in staff are counted per user rather than per IP:
// a whole support team behind one office NAT shouldn't share one budget.
export const apiLimiter = rateLimit({
  ...common,
  windowMs: FIFTEEN_MINUTES,
  limit: (req) => (signedInUserId(req) ? 1500 : 300),
  keyGenerator: (req) => {
    const userId = signedInUserId(req);
    return userId ? `user:${userId}` : ipKeyGenerator(req.ip);
  },
  message: { message: "Too many requests, please try again later." },
});

// Credential checks. Only failed attempts count, so people who type their
// password correctly are never locked out by colleagues on the same IP.
export const authLimiter = rateLimit({
  ...common,
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  skipSuccessfulRequests: true,
  message: { message: "Too many attempts, please try again later." },
});

export const refreshLimiter = rateLimit({
  ...common,
  windowMs: FIFTEEN_MINUTES,
  limit: 120,
  message: { message: "Too many requests, please try again later." },
});

export const passwordResetLimiter = rateLimit({
  ...common,
  windowMs: FIFTEEN_MINUTES,
  limit: 20,
  message: { message: "Too many password reset attempts, please try again later." },
});

// Covers the unauthenticated customer-simulator endpoints (no staff login
// exists to identify the caller, so this is the only throttle they get).
export const ticketSimulatorLimiter = rateLimit({
  ...common,
  windowMs: FIFTEEN_MINUTES,
  limit: 60,
  message: { message: "Too many requests, please try again later." },
});

// Per-user, not per-IP: several agents can share an office network/NAT, and
// throttling them as one caller would be wrong. Only mounted after
// requireAuth, so req.user is always populated by the time this runs.
export const aiAnalysisLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: (req) => (req.user?.userId ? `user:${req.user.userId}` : ipKeyGenerator(req.ip)),
  message: { message: "Too many analysis requests. Please wait a moment and try again." },
});
