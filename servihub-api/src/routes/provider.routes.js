import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import {
  listProviders,
  getProviderById,
  createProvider,
  updateProvider,
  deleteProvider,
} from "../controllers/provider.controller.js";
import {
  listProvidersQuerySchema,
  providerIdParamsSchema,
  createProviderBodySchema,
  updateProviderBodySchema,
} from "../validators/provider.validators.js";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission("provider.read"), validate(listProvidersQuerySchema, "query"), listProviders);

router.post("/", requirePermission("provider.manage"), validate(createProviderBodySchema, "body"), createProvider);

router.get(
  "/:id",
  requirePermission("provider.read"),
  validate(providerIdParamsSchema, "params"),
  getProviderById
);

router.patch(
  "/:id",
  requirePermission("provider.manage"),
  validate(providerIdParamsSchema, "params"),
  validate(updateProviderBodySchema, "body"),
  updateProvider
);

router.delete(
  "/:id",
  requirePermission("provider.manage"),
  validate(providerIdParamsSchema, "params"),
  deleteProvider
);

export default router;
