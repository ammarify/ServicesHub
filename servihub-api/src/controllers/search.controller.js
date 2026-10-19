import { Booking, Customer, Ticket } from "../models/index.js";
import { hasPermission } from "../middleware/rbac.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { escapeRegex } from "../utils/regex.js";

const RESULT_LIMIT = 5;

// Each resource is only searched when the caller's role can read it through
// its own endpoint (e.g. finance has no customer.read), so search never
// leaks a match a role couldn't otherwise see.
export const search = asyncHandler(async (req, res) => {
  const q = req.query.q;

  if (!q) {
    return res.status(200).json({ bookings: [], customers: [], tickets: [] });
  }

  const escaped = escapeRegex(q);
  // Anchored prefix match so the code/name indexes can be used. A bare
  // number ("4801") also finds "BK-4801"/"TK-4801".
  const prefix = new RegExp(`^${escaped}`, "i");
  const codeMatch = /^\d+$/.test(q) ? new RegExp(`^[A-Z]+-${escaped}`, "i") : prefix;
  const role = req.user.role;

  const [bookings, customers, tickets] = await Promise.all([
    hasPermission(role, "booking.read")
      ? Booking.find({ code: codeMatch }).limit(RESULT_LIMIT).select("code service status scheduledAt")
      : [],
    hasPermission(role, "customer.read")
      ? Customer.find({ $or: [{ name: prefix }, { phone: new RegExp(escaped) }] })
          .limit(RESULT_LIMIT)
          .select("name phone area")
      : [],
    hasPermission(role, "ticket.read")
      ? Ticket.find({ $or: [{ code: codeMatch }, { subject: prefix }] })
          .limit(RESULT_LIMIT)
          .select("code subject status priority")
      : [],
  ]);

  res.status(200).json({ bookings, customers, tickets });
});
