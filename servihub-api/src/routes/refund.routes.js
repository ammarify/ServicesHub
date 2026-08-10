import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import {
  listRefunds,
  getRefundById,
  createRefund,
  decideRefund,
} from "../controllers/refund.controller.js";
import {
  listRefundsQuerySchema,
  refundIdParamsSchema,
  createRefundBodySchema,
  refundDecisionBodySchema,
} from "../validators/refund.validators.js";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission("refund.read"), validate(listRefundsQuerySchema, "query"), listRefunds);

router.get(
  "/:id",
  requirePermission("refund.read"),
  validate(refundIdParamsSchema, "params"),
  getRefundById
);

router.post(
  "/",
  requirePermission("refund.request"),
  validate(createRefundBodySchema, "body"),
  createRefund
);

router.patch(
  "/:id/decision",
  requirePermission("refund.approve"),
  validate(refundIdParamsSchema, "params"),
  validate(refundDecisionBodySchema, "body"),
  decideRefund
);

export default router;
