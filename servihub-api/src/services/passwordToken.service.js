import crypto from "node:crypto";
import { env } from "../config/env.js";
import { PasswordToken } from "../models/index.js";

const TOKEN_TTL_MS = {
  reset: 60 * 60 * 1000, // 1 hour
  invite: 7 * 24 * 60 * 60 * 1000, // 7 days
};

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

// Issues a fresh single-use token and invalidates any earlier unused token
// of the same purpose for that user, so only the newest link works.
export async function createPasswordToken(userId, purpose) {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS[purpose]);

  await PasswordToken.deleteMany({ user: userId, purpose, usedAt: null });
  await PasswordToken.create({ user: userId, tokenHash: hashToken(rawToken), purpose, expiresAt });

  return { token: rawToken, expiresAt };
}

export function buildPasswordLink(rawToken) {
  const base = env.RESET_PASSWORD_URL_BASE ?? `${env.APP_URL}/reset-password`;
  const url = new URL(base);
  url.searchParams.set("token", rawToken);
  return url.toString();
}

// Returns the matching unused, unexpired token document (with its user
// populated), or null.
export async function findUsablePasswordToken(rawToken) {
  if (typeof rawToken !== "string" || rawToken.length < 20 || rawToken.length > 200) {
    return null;
  }

  return PasswordToken.findOne({
    tokenHash: hashToken(rawToken),
    usedAt: null,
    expiresAt: { $gt: new Date() },
  }).populate("user");
}

export async function consumePasswordToken(tokenDoc) {
  // Atomic: only the first request that flips usedAt wins.
  const result = await PasswordToken.updateOne(
    { _id: tokenDoc._id, usedAt: null },
    { $set: { usedAt: new Date() } }
  );
  if (result.modifiedCount !== 1) return false;

  await PasswordToken.deleteMany({ user: tokenDoc.user._id, usedAt: null });
  return true;
}
