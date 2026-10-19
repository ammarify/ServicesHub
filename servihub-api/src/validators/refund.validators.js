import { z } from "zod";
import { moneySchema, objectIdSchema, paginationSchema } from "./common.js";

export const listRefundsQuerySchema = paginationSchema.extend({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  bookingId: objectIdSchema.optional(),
});

export const refundIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const createRefundBodySchema = z.object({
  bookingId: objectIdSchema,
  amount: moneySchema,
  reason: z.string().trim().min(1, "Reason is required").max(500),
});

export const refundDecisionBodySchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(500).optional(),
});
