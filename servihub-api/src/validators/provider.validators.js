import { z } from "zod";
import { SERVICES } from "../config/services.js";
import {
  areaSchema,
  booleanQueryParam,
  objectIdSchema,
  paginationSchema,
  personNameSchema,
  phoneSchema,
} from "./common.js";

export const listProvidersQuerySchema = paginationSchema.extend({
  service: z.enum(SERVICES).optional(),
  availableOnly: booleanQueryParam,
  search: z.string().trim().min(1).max(100).optional(),
});

export const providerIdParamsSchema = z.object({
  id: objectIdSchema,
});

const servicesSchema = z
  .array(z.enum(SERVICES))
  .min(1, "Pick at least one service")
  .transform((services) => [...new Set(services)]);

export const createProviderBodySchema = z.object({
  name: personNameSchema,
  phone: phoneSchema,
  area: areaSchema,
  services: servicesSchema,
  isAvailable: z.boolean().optional().default(true),
  verified: z.boolean().optional().default(false),
});

export const updateProviderBodySchema = z
  .object({
    name: personNameSchema.optional(),
    phone: phoneSchema.optional(),
    area: areaSchema.optional(),
    services: servicesSchema.optional(),
    isAvailable: z.boolean().optional(),
    verified: z.boolean().optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: "Nothing to update",
  });
