import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { ticketSimulatorLimiter, aiAnalysisLimiter } from "../middleware/rateLimiters.js";
import {
  listTickets,
  getTicketById,
  addAgentMessage,
  updateTicketStatus,
  updateTicketPriority,
  analyzeTicket,
  createTicketFromCustomer,
  addCustomerMessage,
  getSimulatorOptions,
  getSimulatorTicketById,
} from "../controllers/ticket.controller.js";
import {
  listTicketsQuerySchema,
  ticketIdParamsSchema,
  agentMessageBodySchema,
  customerMessageBodySchema,
  updateTicketStatusBodySchema,
  updateTicketPriorityBodySchema,
  createTicketBodySchema,
} from "../validators/ticket.validators.js";

const router = Router();

// Unauthenticated customer-simulator endpoints. There's no customer login
// in this system (only staff have User accounts) - these stand in for an
// external customer-facing widget, so they're rate-limited instead of
// gated behind requireAuth/requirePermission.
router.post(
  "/",
  ticketSimulatorLimiter,
  validate(createTicketBodySchema, "body"),
  createTicketFromCustomer
);

router.get("/simulator/options", ticketSimulatorLimiter, getSimulatorOptions);

router.get(
  "/simulator/:id",
  ticketSimulatorLimiter,
  validate(ticketIdParamsSchema, "params"),
  getSimulatorTicketById
);

router.post(
  "/:id/customer-message",
  ticketSimulatorLimiter,
  validate(ticketIdParamsSchema, "params"),
  validate(customerMessageBodySchema, "body"),
  addCustomerMessage
);

// Everything below is staff-facing.
router.use(requireAuth);

router.get("/", requirePermission("ticket.read"), validate(listTicketsQuerySchema, "query"), listTickets);

router.get(
  "/:id",
  requirePermission("ticket.read"),
  validate(ticketIdParamsSchema, "params"),
  getTicketById
);

router.post(
  "/:id/messages",
  requirePermission("ticket.reply"),
  validate(ticketIdParamsSchema, "params"),
  validate(agentMessageBodySchema, "body"),
  addAgentMessage
);

router.patch(
  "/:id/status",
  requirePermission("ticket.resolve"),
  validate(ticketIdParamsSchema, "params"),
  validate(updateTicketStatusBodySchema, "body"),
  updateTicketStatus
);

router.patch(
  "/:id/priority",
  requirePermission("ticket.resolve"),
  validate(ticketIdParamsSchema, "params"),
  validate(updateTicketPriorityBodySchema, "body"),
  updateTicketPriority
);

router.post(
  "/:id/analyze",
  requirePermission("ticket.read"),
  aiAnalysisLimiter,
  validate(ticketIdParamsSchema, "params"),
  analyzeTicket
);

export default router;
