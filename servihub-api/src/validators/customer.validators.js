import { z } from "zod";
import { areaSchema, objectIdSchema, paginationSchema, personNameSchema, phoneSchema } from "./common.js";

export const listCustomersQuerySchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
});

export const customerIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const createCustomerBodySchema = z.object({
  name: personNameSchema,
  phone: phoneSchema,
  area: areaSchema,
});

export const updateCustomerBodySchema = z
  .object({
    name: personNameSchema.optional(),
    phone: phoneSchema.optional(),
    area: areaSchema.optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: "Nothing to update",
  });
