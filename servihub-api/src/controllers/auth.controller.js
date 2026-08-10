import bcrypt from "bcryptjs";
import { User } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import { setAccessCookie, setRefreshCookie, clearAuthCookies } from "../utils/cookies.js";
import { verifyGoogleCredential } from "../services/googleAuth.service.js";

const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";
const GOOGLE_VERIFICATION_FAILED_MESSAGE = "Google sign-in could not be verified. Please try again.";
const DISABLED_ACCOUNT_MESSAGE = "This account has been disabled. Contact an administrator.";

function toPublicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function issueSession(res, user) {
  const accessToken = signAccessToken({ userId: user._id.toString(), role: user.role });
  const refreshToken = signRefreshToken({ userId: user._id.toString(), tokenVersion: user.tokenVersion });
  setAccessCookie(res, accessToken);
  setRefreshCookie(res, refreshToken);
}

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new ApiError(401, INVALID_CREDENTIALS_MESSAGE);
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new ApiError(401, INVALID_CREDENTIALS_MESSAGE);
  }

  if (user.status !== "active") {
    throw new ApiError(403, DISABLED_ACCOUNT_MESSAGE);
  }

  issueSession(res, user);
  res.status(200).json({ user: toPublicUser(user) });
});

export const googleLogin = asyncHandler(async (req, res) => {
  const { credential } = req.body;

  let payload;
  try {
    payload = await verifyGoogleCredential(credential);
  } catch {
    throw new ApiError(401, GOOGLE_VERIFICATION_FAILED_MESSAGE);
  }

  if (!payload?.email_verified) {
    throw new ApiError(401, GOOGLE_VERIFICATION_FAILED_MESSAGE);
  }

  // No self-registration, ever - Google only proves who someone is, not
  // that they should have a ServiHub account. Accounts are provisioned
  // exclusively through Settings/Team by a super_admin.
  const user = await User.findOne({ email: payload.email.toLowerCase() });
  if (!user) {
    throw new ApiError(404, "No ServiHub account found for this email. Contact your administrator.");
  }

  if (user.status !== "active") {
    throw new ApiError(403, DISABLED_ACCOUNT_MESSAGE);
  }

  issueSession(res, user);
  res.status(200).json({ user: toPublicUser(user) });
});

export const demoLogin = asyncHandler(async (req, res) => {
  const { role } = req.body;

  const user = await User.findOne({ role, status: "active" });
  if (!user) {
    throw new ApiError(404, "No demo user found for this role");
  }

  issueSession(res, user);
  res.status(200).json({ user: toPublicUser(user) });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) {
    throw new ApiError(401, "Refresh token missing");
  }

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const user = await User.findById(payload.userId);
  if (!user || user.tokenVersion !== payload.tokenVersion || user.status !== "active") {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  issueSession(res, user);
  res.status(200).json({ message: "Token refreshed" });
});

export const logout = asyncHandler(async (req, res) => {
  clearAuthCookies(res);
  res.status(200).json({ message: "Logged out" });
});

export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) {
    throw new ApiError(401, "User not found");
  }

  res.status(200).json({ user: { ...toPublicUser(user), status: user.status } });
});
