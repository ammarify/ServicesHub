import { z } from "zod";
import { objectIdSchema, paginationSchema } from "./common.js";

const TICKET_STATUSES = ["open", "in_progress", "resolved"];
const PRIORITIES = ["low", "medium", "high"];

export const listTicketsQuerySchema = paginationSchema.extend({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
});

export const ticketIdParamsSchema = z.object({
  id: objectIdSchema,
});

const messageText = z.string().trim().min(1, "Message can't be empty").max(2000, "Message is too long");

export const agentMessageBodySchema = z.object({
  text: messageText,
});

export const customerMessageBodySchema = z.object({
  text: messageText,
});

export const updateTicketStatusBodySchema = z.object({
  status: z.enum(TICKET_STATUSES),
});

export const updateTicketPriorityBodySchema = z.object({
  priority: z.enum(PRIORITIES),
});

export const createTicketBodySchema = z.object({
  customerId: objectIdSchema,
  bookingId: objectIdSchema,
  subject: z.string().trim().min(1, "Subject is required").max(200),
  text: messageText,
  priority: z.enum(PRIORITIES),
});

export const simulatorSessionBodySchema = z.object({
  customerId: objectIdSchema,
  ticketId: objectIdSchema,
});
