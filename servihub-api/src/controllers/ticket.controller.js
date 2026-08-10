import { Ticket, Customer, Booking, User } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateNextCode } from "../utils/generateCode.js";
import { appendMessage } from "../services/ticket.service.js";
import { analyzeTicketWithAI } from "../services/aiAnalysis.service.js";
import { getIO } from "../sockets/index.js";

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
};

export const listTickets = asyncHandler(async (req, res) => {
  const { page, limit, status, priority } = req.query;

  const match = {};
  if (status) match.status = status;
  if (priority) match.priority = priority;

  const pipeline = [];
  if (Object.keys(match).length > 0) pipeline.push({ $match: match });

  pipeline.push(
    { $addFields: { lastMessage: { $arrayElemAt: ["$messages", -1] } } },
    { $addFields: { unanswered: { $eq: ["$lastMessage.from", "customer"] } } },
    { $lookup: { from: "customers", localField: "customer", foreignField: "_id", as: "customer" } },
    { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
    { $sort: { updatedAt: -1 } },
    {
      $facet: {
        items: [{ $skip: (page - 1) * limit }, { $limit: limit }, { $project: LIST_PROJECTION }],
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
  const ticket = await Ticket.findById(req.params.id)
    .populate({
      path: "booking",
      populate: { path: "provider", select: "name phone services rating isAvailable" },
    })
    .populate("customer", "name phone area");

  if (!ticket) {
    throw new ApiError(404, "Ticket not found");
  }

  res.status(200).json({ ticket });
});

export const addAgentMessage = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) {
    throw new ApiError(404, "Ticket not found");
  }

  const agent = await User.findById(req.user.userId);
  if (!agent) {
    throw new ApiError(401, "User not found");
  }

  const message = appendMessage(ticket, { from: "agent", senderName: agent.name, text: req.body.text });
  await ticket.save();

  getIO()?.to(`ticket:${ticket._id}`).emit("ticket:message", { ticketId: ticket._id.toString(), message });

  res.status(201).json({ message });
});

const TICKET_POPULATE = [
  { path: "booking", populate: { path: "provider", select: "name phone services rating isAvailable" } },
  { path: "customer", select: "name phone area" },
];

export const updateTicketStatus = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) {
    throw new ApiError(404, "Ticket not found");
  }

  ticket.status = req.body.status;
  await ticket.save();
  // getTicketById returns booking/provider/customer populated, and the
  // frontend caches this response in place of that GET's result (no
  // refetch) - an unpopulated response here would silently replace
  // populated sub-objects with raw ids.
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

  let result;
  try {
    result = await analyzeTicketWithAI({
      ticket,
      booking: ticket.booking,
      customerSummary: { totalBookings, priorTicketsCount },
    });
  } catch (err) {
    // Logged server-side only - the client only ever gets the generic
    // message below, never the provider's raw error (which could include
    // request/response details we don't want to expose, though never the
    // API key itself - that's sent as an Authorization header, not echoed
    // back in error bodies).
    console.error("AI analysis failed:", err.message);
    throw new ApiError(502, "AI analysis is temporarily unavailable. Please try again.");
  }

  ticket.aiAnalysis = { ...result.data, analyzedAt: new Date() };
  await ticket.save();

  res.status(200).json({ aiAnalysis: ticket.aiAnalysis });
});

// Public read endpoints for the customer simulator (Servicehub-admin's
// /simulator page) - there's no customer login, so the picklists it needs
// (which customers exist, which bookings/open tickets are theirs) have to
// come from somewhere that doesn't require the staff-only GET /customers
// or GET /tickets. Capped the same way every list endpoint in this app is,
// even though simulator data volume is small.
const SIMULATOR_CUSTOMER_LIMIT = 50;
const SIMULATOR_SUBLIST_LIMIT = 20;

export const getSimulatorOptions = asyncHandler(async (req, res) => {
  const customers = await Customer.find().select("name").sort({ name: 1 }).limit(SIMULATOR_CUSTOMER_LIMIT);
  const customerIds = customers.map((c) => c._id);

  const [bookings, openTickets] = await Promise.all([
    Booking.find({ customer: { $in: customerIds } })
      .select("code service customer")
      .limit(SIMULATOR_CUSTOMER_LIMIT * SIMULATOR_SUBLIST_LIMIT),
    Ticket.find({ customer: { $in: customerIds }, status: { $ne: "resolved" } })
      .select("code subject customer")
      .limit(SIMULATOR_CUSTOMER_LIMIT * SIMULATOR_SUBLIST_LIMIT),
  ]);

  const result = customers.map((customer) => {
    const idStr = customer._id.toString();
    return {
      id: customer._id,
      name: customer.name,
      bookings: bookings
        .filter((b) => b.customer.toString() === idStr)
        .map((b) => ({ id: b._id, code: b.code, service: b.service })),
      openTickets: openTickets
        .filter((t) => t.customer.toString() === idStr)
        .map((t) => ({ id: t._id, code: t.code, subject: t.subject })),
    };
  });

  res.status(200).json({ customers: result });
});

export const getSimulatorTicketById = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id).select("code subject status priority messages customer");
  if (!ticket) {
    throw new ApiError(404, "Ticket not found");
  }
  res.status(200).json({ ticket });
});

export const createTicketFromCustomer = asyncHandler(async (req, res) => {
  const { customerId, bookingId, subject, text, priority } = req.body;

  const [customer, booking] = await Promise.all([Customer.findById(customerId), Booking.findById(bookingId)]);

  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }
  if (booking.customer.toString() !== customerId) {
    throw new ApiError(400, "Booking does not belong to this customer");
  }

  const code = await generateNextCode(Ticket, "TK");

  const ticket = await Ticket.create({
    code,
    booking: booking._id,
    customer: customer._id,
    subject,
    priority,
    status: "open",
    messages: [{ from: "customer", senderName: customer.name, text, at: new Date() }],
  });

  getIO()?.to("agents").emit("ticket:new", ticket);

  res.status(201).json({ ticket });
});

export const addCustomerMessage = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) {
    throw new ApiError(404, "Ticket not found");
  }

  const customer = await Customer.findById(ticket.customer);
  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  const message = appendMessage(ticket, { from: "customer", senderName: customer.name, text: req.body.text });
  await ticket.save();

  getIO()?.to(`ticket:${ticket._id}`).emit("ticket:message", { ticketId: ticket._id.toString(), message });

  res.status(201).json({ message });
});
