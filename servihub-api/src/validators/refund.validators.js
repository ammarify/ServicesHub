import { z } from "zod";
import { objectIdSchema, paginationSchema } from "./common.js";

export const listRefundsQuerySchema = paginationSchema.extend({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

export const refundIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const createRefundBodySchema = z.object({
  bookingId: objectIdSchema,
  amount: z.coerce.number().positive(),
  reason: z.string().trim().min(1).max(500),
});

export const refundDecisionBodySchema = z.object({
  decision: z.enum(["approved", "rejected"]),
});
