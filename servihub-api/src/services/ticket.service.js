import { Customer, Ticket, User } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import {
  emitCustomerMessageNotice,
  emitTicketMessage,
  emitTicketUpdated,
} from "../sockets/emitter.js";

export const MAX_MESSAGE_LENGTH = 2000;

export function appendMessage(ticket, { from, senderName, text }) {
  ticket.messages.push({ from, senderName, text, at: new Date() });
  return ticket.messages[ticket.messages.length - 1].toObject();
}

// The one write path for customer messages, shared by the REST endpoint and
// the simulator's socket event. A customer writing back on a resolved
// ticket reopens it.
export async function postCustomerMessage(ticketId, text) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    throw new ApiError(404, "Ticket not found");
  }

  const customer = await Customer.findById(ticket.customer).select("name").lean();
  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  const reopened = ticket.status === "resolved";
  if (reopened) ticket.status = "open";

  const message = appendMessage(ticket, { from: "customer", senderName: customer.name, text });
  await ticket.save();

  emitTicketMessage(ticket, message);
  emitCustomerMessageNotice(ticket, message);
  if (reopened) emitTicketUpdated(ticket);

  return { ticket, message };
}

// Agent replies. The first reply on an open ticket moves it to
// in_progress - an agent is now working it.
export async function postAgentMessage(ticketId, userId, text) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    throw new ApiError(404, "Ticket not found");
  }

  const agent = await User.findById(userId).select("name").lean();
  if (!agent) {
    throw new ApiError(401, "User not found", "INVALID_TOKEN");
  }

  const statusChanged = ticket.status === "open";
  if (statusChanged) ticket.status = "in_progress";

  const message = appendMessage(ticket, { from: "agent", senderName: agent.name, text });
  await ticket.save();

  emitTicketMessage(ticket, message);
  if (statusChanged) emitTicketUpdated(ticket);

  return { ticket, message };
}
