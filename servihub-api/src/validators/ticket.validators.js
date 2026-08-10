import { z } from "zod";
import { objectIdSchema, paginationSchema } from "./common.js";

export const listTicketsQuerySchema = paginationSchema.extend({
  status: z.enum(["open", "in_progress", "resolved"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

export const ticketIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const agentMessageBodySchema = z.object({
  text: z.string().trim().min(1).max(2000),
});

export const customerMessageBodySchema = z.object({
  text: z.string().trim().min(1).max(2000),
});

export const updateTicketStatusBodySchema = z.object({
  status: z.enum(["open", "in_progress", "resolved"]),
});

export const updateTicketPriorityBodySchema = z.object({
  priority: z.enum(["low", "medium", "high"]),
});

export const createTicketBodySchema = z.object({
  customerId: objectIdSchema,
  bookingId: objectIdSchema,
  subject: z.string().trim().min(1).max(200),
  text: z.string().trim().min(1).max(2000),
  priority: z.enum(["low", "medium", "high"]),
});
