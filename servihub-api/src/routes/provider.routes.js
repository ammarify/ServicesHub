import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { listProviders, getProviderById } from "../controllers/provider.controller.js";
import { listProvidersQuerySchema, providerIdParamsSchema } from "../validators/provider.validators.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  requirePermission("provider.read"),
  validate(listProvidersQuerySchema, "query"),
  listProviders
);

router.get(
  "/:id",
  requirePermission("provider.read"),
  validate(providerIdParamsSchema, "params"),
  getProviderById
);

export default router;
