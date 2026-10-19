import { Router } from "express";
import {
  changePassword,
  demoLogin,
  forgotPassword,
  googleLogin,
  login,
  logout,
  logoutAll,
  me,
  refresh,
  resetPassword,
  updateProfile,
  verifyPasswordToken,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { authLimiter, passwordResetLimiter, refreshLimiter } from "../middleware/rateLimiters.js";
import {
  changePasswordSchema,
  demoLoginSchema,
  forgotPasswordSchema,
  googleLoginSchema,
  loginSchema,
  passwordTokenSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from "../validators/auth.validators.js";

const router = Router();

router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/google", authLimiter, validate(googleLoginSchema), googleLogin);
router.post("/demo-login", authLimiter, validate(demoLoginSchema), demoLogin);
router.post("/refresh", refreshLimiter, refresh);
router.post("/logout", logout);

router.post("/forgot-password", passwordResetLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password/verify", passwordResetLimiter, validate(passwordTokenSchema), verifyPasswordToken);
router.post("/reset-password", passwordResetLimiter, validate(resetPasswordSchema), resetPassword);

router.get("/me", requireAuth, me);
router.patch("/me", requireAuth, validate(updateProfileSchema), updateProfile);
router.post("/change-password", requireAuth, authLimiter, validate(changePasswordSchema), changePassword);
router.post("/logout-all", requireAuth, logoutAll);

export default router;
