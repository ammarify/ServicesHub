import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { requireDemoMode, requireSimulatorToken } from "../middleware/simulator.js";
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
  startSimulatorSession,
} from "../controllers/ticket.controller.js";
import {
  listTicketsQuerySchema,
  ticketIdParamsSchema,
  agentMessageBodySchema,
  customerMessageBodySchema,
  updateTicketStatusBodySchema,
  updateTicketPriorityBodySchema,
  createTicketBodySchema,
  simulatorSessionBodySchema,
} from "../validators/ticket.validators.js";

const router = Router();

// Customer-simulator endpoints. There's no customer login in this system
// (only staff have accounts); these stand in for an external customer
// widget, exist only in DEMO_MODE, and every ticket-specific call needs the
// per-ticket token returned when the ticket was opened or resumed.
const simulator = [requireDemoMode, ticketSimulatorLimiter];

router.post("/", ...simulator, validate(createTicketBodySchema, "body"), createTicketFromCustomer);

router.get("/simulator/options", ...simulator, getSimulatorOptions);

router.post(
  "/simulator/session",
  ...simulator,
  validate(simulatorSessionBodySchema, "body"),
  startSimulatorSession
);

router.get(
  "/simulator/:id",
  ...simulator,
  validate(ticketIdParamsSchema, "params"),
  requireSimulatorToken,
  getSimulatorTicketById
);

router.post(
  "/:id/customer-message",
  ...simulator,
  validate(ticketIdParamsSchema, "params"),
  requireSimulatorToken,
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
