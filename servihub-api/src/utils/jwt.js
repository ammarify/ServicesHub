import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const ISSUER = "servihub-api";
const ACCESS_AUDIENCE = "servihub-admin";
const SIMULATOR_AUDIENCE = "servihub-simulator";
const SIMULATOR_TOKEN_TTL = "12h";

// Access token: { userId, role, sid, tv }. `sid` ties it to the refresh
// session it came from, `tv` to the user's tokenVersion at issue time.
export function signAccessToken({ userId, role, sessionId, tokenVersion }) {
  return jwt.sign({ userId, role, sid: sessionId, tv: tokenVersion }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
    issuer: ISSUER,
    audience: ACCESS_AUDIENCE,
  });
}

export function verifyAccessToken(token, { ignoreExpiration = false } = {}) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: ISSUER,
    audience: ACCESS_AUDIENCE,
    ignoreExpiration,
  });
}

// Refresh token: { userId, sid, jti, tv }. Signed with its own secret, and
// only ever accepted by /auth/refresh and /auth/logout.
export function signRefreshToken({ userId, sessionId, jti, tokenVersion, expiresAt }) {
  const exp = Math.floor(expiresAt.getTime() / 1000);
  return jwt.sign({ userId, sid: sessionId, jti, tv: tokenVersion, exp }, env.JWT_REFRESH_SECRET, {
    issuer: ISSUER,
  });
}

export function verifyRefreshToken(token, { ignoreExpiration = false } = {}) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, { issuer: ISSUER, ignoreExpiration });
}

// Customer-simulator token, scoped to exactly one ticket. Lets the public
// demo widget read and post to the ticket it opened (or was handed) without
// being able to touch any other ticket.
export function signSimulatorToken({ ticketId, customerId }) {
  return jwt.sign({ ticketId, customerId }, env.JWT_ACCESS_SECRET, {
    expiresIn: SIMULATOR_TOKEN_TTL,
    issuer: ISSUER,
    audience: SIMULATOR_AUDIENCE,
  });
}

export function verifySimulatorToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: ISSUER, audience: SIMULATOR_AUDIENCE });
}
