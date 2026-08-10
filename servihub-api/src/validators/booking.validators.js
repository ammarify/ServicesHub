import { z } from "zod";
import { objectIdSchema, paginationSchema } from "./common.js";

export const listBookingsQuerySchema = paginationSchema.extend({
  status: z.enum(["pending", "assigned", "in_progress", "completed", "cancelled"]).optional(),
  service: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  sortBy: z.enum(["scheduledAt", "amount"]).default("scheduledAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export const bookingIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const reassignBookingBodySchema = z.object({
  providerId: objectIdSchema,
});
