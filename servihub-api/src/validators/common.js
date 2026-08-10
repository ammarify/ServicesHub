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
