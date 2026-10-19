import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { ACCESS_COOKIE } from "../utils/cookies.js";
import { Session, User } from "../models/index.js";

// A valid JWT on its own says nothing about whether the account was
// disabled, its role changed, "log out everywhere" was used, or the device
// signed out after the token was issued. Re-reading the user and session on
// every request would answer that exactly but costs DB round trips per
// call, so short in-process caches sit in between: { status, role,
// tokenVersion } per user and "still open?" per session.
//
// - cache hits (the common case) cost nothing;
// - a miss does one small, indexed lookup;
// - invalidateAuthCache() / invalidateSessionCache() run right after an
//   admin change or a sign-out, so those take effect immediately on this
//   instance.
//
// The cache is per process. With several API instances, an instance that
// didn't handle the change catches up within AUTH_CACHE_TTL_MS; a shared
// store (Redis) would be the next step for a horizontally scaled deploy.
const AUTH_CACHE_TTL_MS = 60 * 1000;
// Entries expire on read; this only stops a long-running process from
// keeping every user/session it has ever seen.
const MAX_CACHE_ENTRIES = 10_000;
const authCache = new Map();
const sessionCache = new Map();

function remember(cache, key, value) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const now = Date.now();
    for (const [entryKey, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(entryKey);
    }
    if (cache.size >= MAX_CACHE_ENTRIES) cache.clear();
  }
  cache.set(key, value);
}

async function getFreshAuthState(userId) {
  const cached = authCache.get(userId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached;
  }

  const user = await User.findById(userId).select("name status role tokenVersion").lean();
  const state = {
    exists: Boolean(user),
    name: user?.name ?? null,
    status: user?.status ?? null,
    role: user?.role ?? null,
    tokenVersion: user?.tokenVersion ?? null,
    expiresAt: now + AUTH_CACHE_TTL_MS,
  };
  remember(authCache, userId, state);
  return state;
}

// Whether the sign-in session an access token belongs to is still open.
// Signing out (or a detected refresh-token replay) revokes the session; this
// check makes the access token issued for it stop working at once too,
// instead of staying valid until it expires.
async function isSessionActive(sessionId) {
  if (!mongoose.isValidObjectId(sessionId)) return false;

  const cached = sessionCache.get(sessionId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.active;
  }

  const session = await Session.findById(sessionId).select("revokedAt expiresAt").lean();
  const active = Boolean(session && !session.revokedAt && session.expiresAt > new Date(now));
  remember(sessionCache, sessionId, { active, expiresAt: now + AUTH_CACHE_TTL_MS });
  return active;
}

export function invalidateAuthCache(userId) {
  authCache.delete(userId.toString());
}

export function invalidateSessionCache(sessionId) {
  sessionCache.delete(sessionId.toString());
}

// Shared by the HTTP middleware below and the Socket.IO handshake, so both
// transports apply exactly the same rules. Throws ApiError(401) with a
// machine-readable code the admin app reacts to:
//   AUTH_REQUIRED    - no token at all
//   TOKEN_EXPIRED    - token expired; the client should call /auth/refresh
//   INVALID_TOKEN    - malformed/forged token, or the user no longer exists
//   ACCOUNT_DISABLED - an admin disabled the account
//   SESSION_REVOKED  - password changed, "log out everywhere", role change,
//                      or this device's session was signed out / revoked
export async function authenticateAccessToken(token) {
  if (!token) {
    throw new ApiError(401, "Authentication required", "AUTH_REQUIRED");
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new ApiError(401, "Access token expired", "TOKEN_EXPIRED");
    }
    throw new ApiError(401, "Invalid authentication token", "INVALID_TOKEN");
  }

  const state = await getFreshAuthState(payload.userId);
  if (!state.exists) {
    throw new ApiError(401, "Invalid authentication token", "INVALID_TOKEN");
  }
  if (state.status !== "active") {
    throw new ApiError(401, "This account has been disabled", "ACCOUNT_DISABLED");
  }
  if (payload.tv !== state.tokenVersion || !(await isSessionActive(payload.sid))) {
    throw new ApiError(401, "Your session has ended. Please sign in again.", "SESSION_REVOKED");
  }

  // The role comes from the (cached) database read, not the JWT, so
  // permission checks always use the current role.
  return { userId: payload.userId, role: state.role, name: state.name, sessionId: payload.sid };
}

export const requireAuth = asyncHandler(async (req, res, next) => {
  req.user = await authenticateAccessToken(req.cookies?.[ACCESS_COOKIE]);
  next();
});
