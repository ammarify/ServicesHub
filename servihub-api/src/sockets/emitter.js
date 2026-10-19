// Holds the Socket.IO server instance and every server -> client emit the
// API performs. Controllers and services import from here (never from
// sockets/index.js) so no import cycle can form, and a request never fails
// just because the realtime layer isn't running (e.g. in unit tests).
let io = null;

export const ROOMS = {
  agents: "agents", // staff with ticket.read
  approvers: "approvers", // staff with refund.approve
  user: (userId) => `user:${userId}`,
  session: (sessionId) => `session:${sessionId}`,
  ticket: (ticketId) => `ticket:${ticketId}`,
};

export function setIO(instance) {
  io = instance;
}

export function getIO() {
  return io;
}

function emit(room, event, payload) {
  io?.to(room).emit(event, payload);
}

export function disconnectUser(userId) {
  io?.in(ROOMS.user(userId.toString())).disconnectSockets(true);
}

export function disconnectSession(sessionId) {
  io?.in(ROOMS.session(sessionId.toString())).disconnectSockets(true);
}

export function emitTicketCreated(ticket, customerName) {
  emit(ROOMS.agents, "ticket:new", {
    _id: ticket._id.toString(),
    code: ticket.code,
    subject: ticket.subject,
    priority: ticket.priority,
    status: ticket.status,
    createdAt: ticket.createdAt,
    customer: { _id: ticket.customer.toString(), name: customerName },
  });
}

export function emitTicketMessage(ticket, message) {
  emit(ROOMS.ticket(ticket._id.toString()), "ticket:message", {
    ticketId: ticket._id.toString(),
    message,
  });
}

// Lets agents who aren't looking at the ticket know the customer wrote back.
export function emitCustomerMessageNotice(ticket, message) {
  emit(ROOMS.agents, "ticket:customer-message", {
    ticketId: ticket._id.toString(),
    code: ticket.code,
    subject: ticket.subject,
    customerName: message.senderName,
    text: message.text.length > 140 ? `${message.text.slice(0, 137)}...` : message.text,
    at: message.at,
  });
}

export function emitTicketUpdated(ticket) {
  const payload = {
    ticketId: ticket._id.toString(),
    status: ticket.status,
    priority: ticket.priority,
    updatedAt: ticket.updatedAt,
  };
  // Agents refresh their queues; the customer widget (which only sits in
  // the ticket's own room) sees the status change too.
  io?.to(ROOMS.agents).to(ROOMS.ticket(payload.ticketId)).emit("ticket:updated", payload);
}

export function emitRefundRequested(refund, { bookingCode, requestedByName }) {
  emit(ROOMS.approvers, "refund:requested", {
    refundId: refund._id.toString(),
    code: refund.code,
    amount: refund.amount,
    bookingCode,
    requestedByName,
    at: refund.createdAt,
  });
}

export function emitRefundDecided(refund, { bookingCode, decidedByName }) {
  const payload = {
    refundId: refund._id.toString(),
    code: refund.code,
    status: refund.status,
    amount: refund.amount,
    bookingCode,
    decidedByName,
    requestedBy: refund.requestedBy?._id?.toString?.() ?? refund.requestedBy?.toString?.() ?? null,
    at: refund.decidedAt,
  };
  io?.to(ROOMS.approvers).to(ROOMS.user(payload.requestedBy)).emit("refund:decided", payload);
}
