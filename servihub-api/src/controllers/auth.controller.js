import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { User } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { clearAuthCookies, REFRESH_COOKIE } from "../utils/cookies.js";
import { permissionsForRole } from "../middleware/rbac.js";
import { invalidateAuthCache } from "../middleware/auth.js";
import { verifyGoogleCredential, isGoogleSignInEnabled } from "../services/googleAuth.service.js";
import {
  endAllSessions,
  endSession,
  refreshSession,
  sessionIdFromCookies,
  startSession,
} from "../services/session.service.js";
import {
  buildPasswordLink,
  consumePasswordToken,
  createPasswordToken,
  findUsablePasswordToken,
} from "../services/passwordToken.service.js";
import { passwordResetEmail, sendEmail } from "../services/email.service.js";
import { Session } from "../models/index.js";

export const BCRYPT_ROUNDS = 12;

const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";
const GOOGLE_VERIFICATION_FAILED_MESSAGE = "Google sign-in could not be verified. Please try again.";
const DISABLED_ACCOUNT_MESSAGE = "This account has been disabled. Contact an administrator.";
const FORGOT_PASSWORD_MESSAGE =
  "If an account exists for that email, we've sent a link to reset the password.";
const INVALID_RESET_LINK_MESSAGE = "This link is invalid or has expired. Request a new one.";

// A bcrypt hash of a random string, compared against when the email doesn't
// match any user, so "unknown email" and "wrong password" take about the
// same time and can't be told apart by response timing.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(`dummy-${Date.now()}`, BCRYPT_ROUNDS);

export function toPublicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    permissions: permissionsForRole(user.role),
  };
}

export const login = asyncHandler(async (req, res) => {
  const { email, password, remember } = req.body;

  const user = await User.findOne({ email });
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordMatches) {
    throw new ApiError(401, INVALID_CREDENTIALS_MESSAGE, "INVALID_CREDENTIALS");
  }

  if (user.status !== "active") {
    throw new ApiError(403, DISABLED_ACCOUNT_MESSAGE, "ACCOUNT_DISABLED");
  }

  await startSession(res, user, { remember, req });
  res.status(200).json({ user: toPublicUser(user) });
});

export const googleLogin = asyncHandler(async (req, res) => {
  if (!isGoogleSignInEnabled()) {
    throw new ApiError(503, "Google sign-in is not configured.", "FEATURE_DISABLED");
  }

  const { credential, remember } = req.body;

  let payload;
  try {
    payload = await verifyGoogleCredential(credential);
  } catch {
    throw new ApiError(401, GOOGLE_VERIFICATION_FAILED_MESSAGE);
  }

  if (!payload?.email || !payload.email_verified) {
    throw new ApiError(401, GOOGLE_VERIFICATION_FAILED_MESSAGE);
  }

  // No self-registration, ever - Google only proves who someone is, not
  // that they should have a ServiHub account. Accounts are provisioned
  // exclusively through Settings -> Team by a super_admin.
  const user = await User.findOne({ email: payload.email.toLowerCase() });
  if (!user) {
    throw new ApiError(404, "No ServiHub account found for this email. Contact your administrator.");
  }

  if (user.status !== "active") {
    throw new ApiError(403, DISABLED_ACCOUNT_MESSAGE, "ACCOUNT_DISABLED");
  }

  await startSession(res, user, { remember, req });
  res.status(200).json({ user: toPublicUser(user) });
});

// Password-less sign-in as the first active user with a role. A demo
// convenience only: it doesn't exist unless DEMO_MODE is on (the default
// outside production).
export const demoLogin = asyncHandler(async (req, res) => {
  if (!env.DEMO_MODE) {
    throw new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`);
  }

  const user = await User.findOne({ role: req.body.role, status: "active" }).sort({ createdAt: 1 });
  if (!user) {
    throw new ApiError(404, "No demo user found for this role");
  }

  await startSession(res, user, { remember: false, req });
  res.status(200).json({ user: toPublicUser(user) });
});

export const refresh = asyncHandler(async (req, res) => {
  try {
    const user = await refreshSession(res, req.cookies?.[REFRESH_COOKIE]);
    res.status(200).json({ user: toPublicUser(user) });
  } catch (err) {
    clearAuthCookies(res);
    throw err;
  }
});

export const logout = asyncHandler(async (req, res) => {
  await endSession(sessionIdFromCookies(req.cookies), "logout");
  clearAuthCookies(res);
  res.status(200).json({ message: "Logged out" });
});

export const logoutAll = asyncHandler(async (req, res) => {
  await endAllSessions(req.user.userId, "logout_all");
  clearAuthCookies(res);
  res.status(200).json({ message: "Signed out of all sessions" });
});

export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) {
    throw new ApiError(401, "User not found", "INVALID_TOKEN");
  }

  res.status(200).json({ user: toPublicUser(user) });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user.userId,
    { $set: { name: req.body.name } },
    { returnDocument: "after", runValidators: true }
  );
  if (!user) {
    throw new ApiError(401, "User not found", "INVALID_TOKEN");
  }
  invalidateAuthCache(user._id);

  res.status(200).json({ user: toPublicUser(user) });
});

// Changing the password signs every other device out (tokenVersion bump +
// all sessions revoked) and starts a fresh session for this one.
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.userId);
  if (!user) {
    throw new ApiError(401, "User not found", "INVALID_TOKEN");
  }

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    throw new ApiError(400, "Current password is incorrect", undefined, {
      currentPassword: "Current password is incorrect",
    });
  }

  const currentSession = await Session.findById(req.user.sessionId).select("remember").lean();

  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  user.passwordSetAt = new Date();
  await user.save();

  await endAllSessions(user._id, "password_changed");

  const refreshed = await User.findById(user._id);
  await startSession(res, refreshed, { remember: currentSession?.remember ?? false, req });
  res.status(200).json({ user: toPublicUser(refreshed) });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });

  // Same response whether or not the account exists, so this endpoint can't
  // be used to discover which emails have accounts.
  if (user && user.status === "active") {
    const { token } = await createPasswordToken(user._id, "reset");
    const email = passwordResetEmail({ name: user.name, link: buildPasswordLink(token) });
    try {
      await sendEmail({ to: user.email, ...email });
    } catch (err) {
      console.error("Password reset email failed:", err.message);
    }
  }

  res.status(200).json({ message: FORGOT_PASSWORD_MESSAGE });
});

// Lets the reset/invite page check a link before showing the form, and
// greet the person by name.
export const verifyPasswordToken = asyncHandler(async (req, res) => {
  const tokenDoc = await findUsablePasswordToken(req.body.token);
  if (!tokenDoc || !tokenDoc.user || tokenDoc.user.status !== "active") {
    throw new ApiError(400, INVALID_RESET_LINK_MESSAGE, "INVALID_PASSWORD_TOKEN");
  }

  res.status(200).json({
    purpose: tokenDoc.purpose,
    name: tokenDoc.user.name,
    email: tokenDoc.user.email,
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const tokenDoc = await findUsablePasswordToken(req.body.token);
  if (!tokenDoc || !tokenDoc.user || tokenDoc.user.status !== "active") {
    throw new ApiError(400, INVALID_RESET_LINK_MESSAGE, "INVALID_PASSWORD_TOKEN");
  }

  const consumed = await consumePasswordToken(tokenDoc);
  if (!consumed) {
    throw new ApiError(400, INVALID_RESET_LINK_MESSAGE, "INVALID_PASSWORD_TOKEN");
  }

  const user = tokenDoc.user;
  user.passwordHash = await bcrypt.hash(req.body.password, BCRYPT_ROUNDS);
  user.passwordSetAt = new Date();
  await user.save();

  // A reset means the old password may be compromised: end every session.
  await endAllSessions(user._id, "password_reset");
  invalidateAuthCache(user._id);

  res.status(200).json({ message: "Your password has been updated. You can sign in now." });
});
