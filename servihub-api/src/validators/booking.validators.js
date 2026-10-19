import { z } from "zod";
import { BOOKING_STATUSES, SERVICES } from "../config/services.js";
import { moneySchema, objectIdSchema, paginationSchema } from "./common.js";

export const listBookingsQuerySchema = paginationSchema.extend({
  status: z.enum(BOOKING_STATUSES).optional(),
  service: z.enum(SERVICES).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  customerId: objectIdSchema.optional(),
  providerId: objectIdSchema.optional(),
  sortBy: z.enum(["scheduledAt", "amount", "createdAt"]).default("scheduledAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export const bookingIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const reassignBookingBodySchema = z.object({
  providerId: objectIdSchema,
});

const scheduledAtSchema = z.coerce
  .date({ error: "Enter a valid date and time" })
  .refine((date) => !Number.isNaN(date.getTime()), { message: "Enter a valid date and time" });

const addressSchema = z.string().trim().min(5, "Address is too short").max(200, "Address is too long");

export const createBookingBodySchema = z.object({
  customerId: objectIdSchema,
  service: z.enum(SERVICES),
  scheduledAt: scheduledAtSchema,
  amount: moneySchema,
  address: addressSchema,
  providerId: objectIdSchema.optional(),
});

export const updateBookingBodySchema = z
  .object({
    scheduledAt: scheduledAtSchema.optional(),
    amount: moneySchema.optional(),
    address: addressSchema.optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: "Nothing to update",
  });

// Forward-only lifecycle moves a staff member can record. Assigning happens
// through reassign, cancelling through cancel.
export const updateBookingStatusBodySchema = z.object({
  status: z.enum(["in_progress", "completed"]),
});

export const cancelBookingBodySchema = z
  .object({
    reason: z.string().trim().max(300).optional(),
  })
  .optional()
  .default({});
