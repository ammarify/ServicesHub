import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { getDashboardSummary } from "../controllers/dashboard.controller.js";

const router = Router();

router.get("/summary", requireAuth, requirePermission("dashboard.read"), getDashboardSummary);

export default router;
