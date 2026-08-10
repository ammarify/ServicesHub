import { Router } from "express";
import { login, googleLogin, demoLogin, refresh, logout, me } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { authLimiter } from "../middleware/rateLimiters.js";
import { loginSchema, googleLoginSchema, demoLoginSchema } from "../validators/auth.validators.js";

const router = Router();

router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/google", authLimiter, validate(googleLoginSchema), googleLogin);
router.post("/demo-login", authLimiter, validate(demoLoginSchema), demoLogin);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", requireAuth, me);

export default router;
