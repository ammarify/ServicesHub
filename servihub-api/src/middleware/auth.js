import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { User } from "../models/index.js";

// requireAuth only verifies the JWT's signature/expiry by default, which
// means a still-valid (up to 15min-lived) access token keeps working even
// after an admin disables the user or changes their role - the token
// itself doesn't know either happened. Re-reading the user on every
// single request would fix that instantly but adds a DB round trip to
// every authenticated call in the app; a Redis-backed revocation list
// would fix it across multiple server instances too, but this app has
// neither Redis nor multiple instances today.
//
// Chosen middle ground: a short in-process TTL cache of {status, role}
// per userId. Cache hits (the common case) cost nothing extra; a miss or
// expiry does one lightweight `select("status role")` lookup. This bounds
// "disabled user with a live token" and "stale role on a live token" to
// at most AUTH_CACHE_TTL_MS instead of the full access-token lifetime -
// and invalidateAuthCache() (called by the team controller right after a
// role/status change) makes the common admin-driven case instant instead
// of waiting out the TTL. The one real limitation: this cache is
// per-process, so in a horizontally-scaled deployment a disable would
// only be instant on the instance that handled it - other instances
// would still catch up within the TTL. Acceptable for this app's single
// server-instance scale; a multi-instance deployment would want a shared
// store (Redis) instead.
const AUTH_CACHE_TTL_MS = 60 * 1000;
const authCache = new Map();

async function getFreshAuthState(userId) {
  const cached = authCache.get(userId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached;
  }

  const user = await User.findById(userId).select("status role");
  const state = {
    status: user?.status ?? null,
    role: user?.role ?? null,
    expiresAt: now + AUTH_CACHE_TTL_MS,
  };
  authCache.set(userId, state);
  return state;
}

export function invalidateAuthCache(userId) {
  authCache.delete(userId.toString());
}

export const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.accessToken;

  if (!token) {
    return next(new ApiError(401, "Authentication required"));
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(new ApiError(401, "Access token expired", "TOKEN_EXPIRED"));
    }
    return next(new ApiError(401, "Invalid authentication token"));
  }

  const state = await getFreshAuthState(payload.userId);
  if (state.status !== "active") {
    return next(new ApiError(401, "This account has been disabled", "ACCOUNT_DISABLED"));
  }

  // role comes from the cached/fresh DB read, not the JWT payload, so a
  // role change takes effect for permission checks within AUTH_CACHE_TTL_MS
  // (or instantly, via invalidateAuthCache) rather than only after the
  // access token itself expires and is refreshed.
  req.user = { userId: payload.userId, role: state.role };
  next();
});
