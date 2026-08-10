import { z } from "zod";
import { objectIdSchema, paginationSchema, booleanQueryParam } from "./common.js";

export const listProvidersQuerySchema = paginationSchema.extend({
  service: z.string().trim().min(1).optional(),
  availableOnly: booleanQueryParam,
  search: z.string().trim().min(1).optional(),
});

export const providerIdParamsSchema = z.object({
  id: objectIdSchema,
});
