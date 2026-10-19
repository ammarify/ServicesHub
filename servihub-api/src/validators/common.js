import { z } from "zod";
import mongoose from "mongoose";

export const objectIdSchema = z.string().refine((val) => mongoose.isValidObjectId(val), {
  message: "Invalid id",
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const booleanQueryParam = z
  .enum(["true", "false"])
  .transform((val) => val === "true")
  .optional();

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
    message: "Password must contain at least one letter and one number",
  });

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

export const personNameSchema = z.string().trim().min(2, "Name is too short").max(80, "Name is too long");

// Phone numbers are stored as typed (e.g. "+1 512-555-0101"); this only
// rejects values that can't plausibly be a phone number.
export const phoneSchema = z
  .string()
  .trim()
  .min(7, "Enter a valid phone number")
  .max(25, "Enter a valid phone number")
  .regex(/^\+?[\d\s().-]+$/, "Enter a valid phone number");

export const areaSchema = z.string().trim().min(2, "Area is too short").max(60, "Area is too long");

// A monetary amount in USD with at most two decimals.
export const moneySchema = z.coerce
  .number()
  .positive("Amount must be greater than zero")
  .max(100000, "Amount is too large")
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
    message: "Amount can have at most two decimals",
  })
  .transform((value) => Math.round(value * 100) / 100);
