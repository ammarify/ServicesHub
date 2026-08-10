import { Booking, Customer, Ticket } from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { escapeRegex } from "../utils/regex.js";

const RESULT_LIMIT = 5;

// Mirrors the *.read rows in middleware/rbac.js. Search must not leak a
// customer/ticket match to a role that couldn't read that resource
// directly through its own list endpoint (e.g. finance has no
// customer.read) - each branch below is skipped entirely for a role
// that isn't allowed to see it, rather than filtered out after the fact.
const RESOURCE_ROLES = {
  bookings: ["super_admin", "manager", "support_agent", "finance"],
  customers: ["super_admin", "manager"],
  tickets: ["super_admin", "manager", "support_agent"],
};

export const search = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(200).json({ bookings: [], customers: [], tickets: [] });
  }

  // Anchored to the start of the field so the query can use the indexed
  // field (code/name) for a bounded scan - a "contains anywhere" pattern
  // can't use an index regardless of case-insensitivity.
  const prefix = new RegExp("^" + escapeRegex(q), "i");
  const role = req.user.role;

  const [bookings, customers, tickets] = await Promise.all([
    RESOURCE_ROLES.bookings.includes(role)
      ? Booking.find({ code: prefix }).limit(RESULT_LIMIT).select("code service status scheduledAt")
      : [],
    RESOURCE_ROLES.customers.includes(role)
      ? Customer.find({ name: prefix }).limit(RESULT_LIMIT).select("name phone area")
      : [],
    RESOURCE_ROLES.tickets.includes(role)
      ? Ticket.find({ code: prefix }).limit(RESULT_LIMIT).select("code subject status priority")
      : [],
  ]);

  res.status(200).json({ bookings, customers, tickets });
});
