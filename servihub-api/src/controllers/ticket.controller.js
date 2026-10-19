import { Ticket, Customer, Booking } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createWithCode } from "../utils/generateCode.js";
import { signSimulatorToken } from "../utils/jwt.js";
import { postAgentMessage, postCustomerMessage } from "../services/ticket.service.js";
import { AiProviderError, AiUnavailableError, analyzeTicketWithAI } from "../services/aiAnalysis.service.js";
import { emitTicketCreated, emitTicketUpdated } from "../sockets/emitter.js";

const LIST_PROJECTION = {
  code: 1,
  subject: 1,
  priority: 1,
  status: 1,
  unanswered: 1,
  createdAt: 1,
  updatedAt: 1,
  hasAnalysis: { $ne: [{ $type: "$aiAnalysis" }, "missing"] },
  customer: { _id: "$customer._id", name: "$customer.name" },
  // A preview for the queue, capped so a long message doesn't bloat the list.
  lastMessage: {
    from: "$lastMessage.from",
    text: { $substrCP: [{ $ifNull: ["$lastMessage.text", ""] }, 0, 140] },
    at: "$lastMessage.at",
  },
};

const TICKET_POPULATE = [
  {
    path: "booking",
    select: "code service status scheduledAt amount address provider customer",
    populate: { path: "provider", select: "name phone services rating isAvailable" },
  },
  { path: "customer", select: "name phone area" },
];

export const listTickets = asyncHandler(async (req, res) => {
  const { page, limit, status, priority } = req.query;

  const match = {};
  if (status) match.status = status;
  if (priority) match.priority = priority;

  const pipeline = [];
  if (Object.keys(match).length > 0) pipeline.push({ $match: match });

  pipeline.push(
    { $sort: { updatedAt: -1, _id: -1 } },
    {
      $facet: {
        items: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $addFields: { lastMessage: { $arrayElemAt: ["$messages", -1] } } },
          { $addFields: { unanswered: { $eq: ["$lastMessage.from", "customer"] } } },
          { $lookup: { from: "customers", localField: "customer", foreignField: "_id", as: "customer" } },
          { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
          { $project: LIST_PROJECTION },
        ],
        totalCount: [{ $count: "count" }],
      },
    }
  );

  const [result] = await Ticket.aggregate(pipeline);
  const items = result.items;
  const total = result.totalCount[0]?.count ?? 0;

  res.status(200).json({ items, total, page, pages: Math.ceil(total / limit) });
});

export const getTicketById = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id).populate(TICKET_POPULATE);

  if (!ticket) {
    throw new ApiError(404, "Ticket not found");
  }

  res.status(200).json({ ticket });
});

export const addAgentMessage = asyncHandler(async (req, res) => {
  const { ticket, message } = await postAgentMessage(req.params.id, req.user.userId, req.body.text);
  res.status(201).json({ message, status: ticket.status });
});

export const updateTicketStatus = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) {
    throw new ApiError(404, "Ticket not found");
  }

  ticket.status = req.body.status;
  await ticket.save();
  emitTicketUpdated(ticket);
  // The admin app writes this response straight into its cache in place of
  // GET /tickets/:id's result, so it must be populated the same way.
  await ticket.populate(TICKET_POPULATE);

  res.status(200).json({ ticket });
});

export const updateTicketPriority = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) {
    throw new ApiError(404, "Ticket not found");
  }

  ticket.priority = req.body.priority;
  await ticket.save();
  emitTicketUpdated(ticket);
  await ticket.populate(TICKET_POPULATE);

  res.status(200).json({ ticket });
});

export const analyzeTicket = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id).populate("booking");
  if (!ticket) {
    throw new ApiError(404, "Ticket not found");
  }

  const [totalBookings, priorTicketsCount] = await Promise.all([
    Booking.countDocuments({ customer: ticket.customer }),
    Ticket.countDocuments({ customer: ticket.customer, _id: { $ne: ticket._id } }),
  ]);

  let analysis;
  try {
    analysis = await analyzeTicketWithAI({
      ticket,
      booking: ticket.booking,
      customerSummary: { totalBookings, priorTicketsCount },
    });
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      throw new ApiError(503, "The AI Copilot isn't configured on this server.", "FEATURE_DISABLED");
    }
    // The details go to the server log only; the client gets a plain
    // message, never the provider's raw error.
    console.error("AI analysis failed:", err.message);
    if (err instanceof AiProviderError && err.kind === "misconfigured") {
      throw new ApiError(
        503,
        "Groq rejected the AI Copilot's API key or model. Ask an administrator to check GROQ_API_KEY and GROQ_MODEL on the server.",
        "AI_MISCONFIGURED"
      );
    }
    if (err instanceof AiProviderError && err.kind === "rate_limited") {
      res.set("Retry-After", String(err.retryAfterSeconds ?? 60));
      throw new ApiError(503, "The AI Copilot is busy right now (Groq's rate limit was reached). Try again in a minute.", "AI_RATE_LIMITED");
    }
    throw new ApiError(502, "AI analysis is temporarily unavailable. Please try again.");
  }

  // Saved with updateOne so storing an analysis doesn't bump the ticket's
  // updatedAt (which orders the support queue).
  const aiAnalysis = { ...analysis, analyzedAt: new Date() };
  await Ticket.updateOne({ _id: ticket._id }, { $set: { aiAnalysis } }, { timestamps: false });

  res.status(200).json({ aiAnalysis });
});

// ---------------------------------------------------------------------------
// Customer simulator (public demo widget; DEMO_MODE only)
//
// There is no customer login in this system, so the simulator picks a
// customer from a list. Every ticket it opens or resumes comes with a token
// scoped to that one ticket; reading or posting to a ticket requires it.
// ---------------------------------------------------------------------------

const SIMULATOR_CUSTOMER_LIMIT = 50;
const SIMULATOR_SUBLIST_LIMIT = 20;

function simulatorView(ticket) {
  return {
    _id: ticket._id,
    code: ticket.code,
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    messages: ticket.messages,
  };
}

function issueSimulatorToken(ticket) {
  return signSimulatorToken({ ticketId: ticket._id.toString(), customerId: ticket.customer.toString() });
}

export const getSimulatorOptions = asyncHandler(async (req, res) => {
  const customers = await Customer.find().select("name").sort({ name: 1 }).limit(SIMULATOR_CUSTOMER_LIMIT).lean();
  const customerIds = customers.map((c) => c._id);

  const [bookings, openTickets] = await Promise.all([
    Booking.find({ customer: { $in: customerIds } })
      .select("code service customer")
      .sort({ scheduledAt: -1 })
      .limit(SIMULATOR_CUSTOMER_LIMIT * SIMULATOR_SUBLIST_LIMIT)
      .lean(),
    Ticket.find({ customer: { $in: customerIds }, status: { $ne: "resolved" } })
      .select("code subject customer")
      .limit(SIMULATOR_CUSTOMER_LIMIT * SIMULATOR_SUBLIST_LIMIT)
      .lean(),
  ]);

  const result = customers.map((customer) => {
    const idStr = customer._id.toString();
    return {
      id: customer._id,
      name: customer.name,
      bookings: bookings
        .filter((b) => b.customer.toString() === idStr)
        .slice(0, SIMULATOR_SUBLIST_LIMIT)
        .map((b) => ({ id: b._id, code: b.code, service: b.service })),
      openTickets: openTickets
        .filter((t) => t.customer.toString() === idStr)
        .slice(0, SIMULATOR_SUBLIST_LIMIT)
        .map((t) => ({ id: t._id, code: t.code, subject: t.subject })),
    };
  });

  res.status(200).json({ customers: result });
});

export const startSimulatorSession = asyncHandler(async (req, res) => {
  const { customerId, ticketId } = req.body;

  const ticket = await Ticket.findById(ticketId).select("code subject status priority messages customer");
  if (!ticket || ticket.customer.toString() !== customerId) {
    throw new ApiError(404, "Ticket not found");
  }

  res.status(200).json({ ticket: simulatorView(ticket), token: issueSimulatorToken(ticket) });
});

export const getSimulatorTicketById = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id).select("code subject status priority messages customer");
  if (!ticket || ticket.customer.toString() !== req.simulator.customerId) {
    throw new ApiError(404, "Ticket not found");
  }
  res.status(200).json({ ticket: simulatorView(ticket) });
});

export const createTicketFromCustomer = asyncHandler(async (req, res) => {
  const { customerId, bookingId, subject, text, priority } = req.body;

  const [customer, booking] = await Promise.all([
    Customer.findById(customerId).select("name").lean(),
    Booking.findById(bookingId).select("customer").lean(),
  ]);

  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }
  if (booking.customer.toString() !== customerId) {
    throw new ApiError(400, "Booking does not belong to this customer");
  }

  const ticket = await createWithCode(Ticket, "TK", (code) => ({
    code,
    booking: booking._id,
    customer: customer._id,
    subject,
    priority,
    status: "open",
    messages: [{ from: "customer", senderName: customer.name, text, at: new Date() }],
  }));

  emitTicketCreated(ticket, customer.name);

  res.status(201).json({ ticket: simulatorView(ticket), token: issueSimulatorToken(ticket) });
});

export const addCustomerMessage = asyncHandler(async (req, res) => {
  const { message } = await postCustomerMessage(req.params.id, req.body.text);
  res.status(201).json({ message });
});
