import rateLimit, { ipKeyGenerator } from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again later." },
});

// Covers the unauthenticated customer-simulator ticket endpoints (no staff
// login exists to identify the caller, so this is the only throttle they get).
export const ticketSimulatorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

// Per-user, not per-IP: several agents can share an office network/NAT, and
// throttling them as one caller would be wrong. Only mounted after
// requireAuth, so req.user is always populated by the time this runs.
export const aiAnalysisLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId ?? ipKeyGenerator(req.ip),
  message: { message: "Too many analysis requests. Please wait a moment and try again." },
});
