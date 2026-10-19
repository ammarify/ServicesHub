import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { getDashboardSummary } from "../controllers/dashboard.controller.js";
import { dashboardQuerySchema } from "../validators/dashboard.validators.js";

const router = Router();

router.get(
  "/summary",
  requireAuth,
  requirePermission("dashboard.read"),
  validate(dashboardQuerySchema, "query"),
  getDashboardSummary
);

export default router;
