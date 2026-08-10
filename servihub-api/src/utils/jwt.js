import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const REFRESH_TOKEN_EXPIRY = "7d";

export function signAccessToken({ userId, role }) {
  return jwt.sign({ userId, role }, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL });
}

export function signRefreshToken({ userId, tokenVersion }) {
  return jwt.sign({ userId, tokenVersion }, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}
