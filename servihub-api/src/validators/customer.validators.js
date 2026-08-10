import { z } from "zod";
import { objectIdSchema, paginationSchema } from "./common.js";

export const listCustomersQuerySchema = paginationSchema.extend({
  search: z.string().trim().min(1).optional(),
});

export const customerIdParamsSchema = z.object({
  id: objectIdSchema,
});
