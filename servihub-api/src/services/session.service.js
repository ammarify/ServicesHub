import crypto from "node:crypto";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Session, User } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { parseDuration } from "../utils/duration.js";
import { ACCESS_COOKIE, REFRESH_COOKIE, setAuthCookies } from "../utils/cookies.js";
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from "../utils/jwt.js";
import { invalidateAuthCache, invalidateSessionCache } from "../middleware/auth.js";
import { disconnectSession, disconnectUser } from "../sockets/emitter.js";

// How long the refresh token a rotation just replaced keeps working. Two
// tabs of the same browser share one cookie jar, so both can send the same
// refresh token at nearly the same moment; without this window the slower
// tab would look like a stolen-token replay and end the session.
const ROTATION_GRACE_MS = 30 * 1000;

const REFRESH_FAILED_MESSAGE = "Your session has expired. Please sign in again.";

function newTokenId() {
  return crypto.randomBytes(16).toString("hex");
}

function sessionLifetimeMs(remember) {
  return parseDuration(remember ? env.REFRESH_TOKEN_TTL : env.SESSION_TOKEN_TTL);
}

function writeSessionCookies(res, user, session) {
  const userId = user._id.toString();
  const sessionId = session._id.toString();

  const accessToken = signAccessToken({
    userId,
    role: user.role,
    sessionId,
    tokenVersion: user.tokenVersion,
  });
  const refreshToken = signRefreshToken({
    userId,
    sessionId,
    jti: session.jti,
    tokenVersion: user.tokenVersion,
    expiresAt: session.expiresAt,
  });

  setAuthCookies(res, {
    accessToken,
    refreshToken,
    maxAgeMs: session.remember ? Math.max(session.expiresAt.getTime() - Date.now(), 0) : null,
  });
}

// Signs `user` in on this device: creates a session record and sets both
// auth cookies.
export async function startSession(res, user, { remember = false, req } = {}) {
  const now = new Date();
  const session = await Session.create({
    user: user._id,
    jti: newTokenId(),
    remember,
    expiresAt: new Date(now.getTime() + sessionLifetimeMs(remember)),
    lastUsedAt: now,
    userAgent: req?.get?.("user-agent")?.slice(0, 300) ?? null,
    ip: req?.ip ?? null,
  });

  user.lastLoginAt = now;
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: now } });

  writeSessionCookies(res, user, session);
  return session;
}

async function revokeSession(sessionId, reason) {
  await Session.updateOne(
    { _id: sessionId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } }
  );
  // The session's access token stops working right away, not when it expires.
  invalidateSessionCache(sessionId);
}

// Exchanges a refresh token for a new access + refresh token pair. Each
// refresh token is single-use: the session stores the id (`jti`) of the only
// refresh token currently valid for it, and every successful refresh
// replaces it. Presenting an older token means two parties hold copies of
// it - one of them stolen - so the whole session is revoked.
export async function refreshSession(res, token) {
  if (!token) {
    throw new ApiError(401, REFRESH_FAILED_MESSAGE, "SESSION_EXPIRED");
  }

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new ApiError(401, REFRESH_FAILED_MESSAGE, "SESSION_EXPIRED");
  }

  if (!mongoose.isValidObjectId(payload.sid) || !mongoose.isValidObjectId(payload.userId)) {
    throw new ApiError(401, REFRESH_FAILED_MESSAGE, "SESSION_EXPIRED");
  }

  const now = new Date();
  const session = await Session.findById(payload.sid);
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= now ||
    session.user.toString() !== payload.userId
  ) {
    throw new ApiError(401, REFRESH_FAILED_MESSAGE, "SESSION_EXPIRED");
  }

  const user = await User.findById(payload.userId);
  if (!user || user.status !== "active" || user.tokenVersion !== payload.tv) {
    await revokeSession(session._id, "account_changed");
    throw new ApiError(401, REFRESH_FAILED_MESSAGE, "SESSION_EXPIRED");
  }

  let current = session;

  if (payload.jti === session.jti) {
    // Compare-and-swap on the jti so two instances (or two requests) can't
    // both rotate the same token.
    const rotated = await Session.findOneAndUpdate(
      { _id: session._id, jti: payload.jti, revokedAt: null },
      {
        $set: {
          jti: newTokenId(),
          previousJti: payload.jti,
          rotatedAt: now,
          lastUsedAt: now,
          expiresAt: new Date(now.getTime() + sessionLifetimeMs(session.remember)),
        },
      },
      { returnDocument: "after" }
    );

    if (rotated) {
      current = rotated;
    } else {
      // Lost the race to a concurrent refresh of the same token; fall
      // through to the grace-period check against the fresh record.
      current = await Session.findById(session._id);
      const withinGrace =
        current &&
        !current.revokedAt &&
        current.previousJti === payload.jti &&
        now.getTime() - current.rotatedAt.getTime() <= ROTATION_GRACE_MS;
      if (!withinGrace) {
        throw new ApiError(401, REFRESH_FAILED_MESSAGE, "SESSION_EXPIRED");
      }
    }
  } else {
    const withinGrace =
      payload.jti === session.previousJti &&
      session.rotatedAt &&
      now.getTime() - session.rotatedAt.getTime() <= ROTATION_GRACE_MS;

    if (!withinGrace) {
      await revokeSession(session._id, "refresh_token_reuse");
      disconnectSession(session._id.toString());
      throw new ApiError(401, REFRESH_FAILED_MESSAGE, "SESSION_REVOKED");
    }
  }

  writeSessionCookies(res, user, current);
  return user;
}

// Best-effort: finds the session id in whichever auth cookie is present
// (signature checked, expiry ignored - an expired token still identifies the
// session that should be closed).
export function sessionIdFromCookies(cookies) {
  const candidates = [
    [cookies?.[REFRESH_COOKIE], verifyRefreshToken],
    [cookies?.[ACCESS_COOKIE], verifyAccessToken],
  ];

  for (const [token, verify] of candidates) {
    if (!token) continue;
    try {
      const payload = verify(token, { ignoreExpiration: true });
      if (mongoose.isValidObjectId(payload.sid)) return payload.sid;
    } catch {
      // try the next cookie
    }
  }
  return null;
}

export async function endSession(sessionId, reason = "logout") {
  if (!sessionId) return;
  await revokeSession(sessionId, reason);
  disconnectSession(sessionId.toString());
}

// Ends every session the user has on every device: bumps tokenVersion (so
// outstanding access tokens stop working immediately, not after 15 min),
// revokes all refresh sessions and drops their live sockets.
export async function endAllSessions(userId, reason) {
  const id = userId.toString();
  await User.updateOne({ _id: id }, { $inc: { tokenVersion: 1 } });
  await Session.updateMany(
    { user: id, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } }
  );
  invalidateAuthCache(id);
  disconnectUser(id);
}
