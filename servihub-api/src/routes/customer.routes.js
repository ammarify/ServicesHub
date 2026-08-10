import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { listCustomers, getCustomerById } from "../controllers/customer.controller.js";
import { listCustomersQuerySchema, customerIdParamsSchema } from "../validators/customer.validators.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  requirePermission("customer.read"),
  validate(listCustomersQuerySchema, "query"),
  listCustomers
);

router.get(
  "/:id",
  requirePermission("customer.read"),
  validate(customerIdParamsSchema, "params"),
  getCustomerById
);

export default router;
