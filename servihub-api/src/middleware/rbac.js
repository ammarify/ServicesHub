import { ApiError } from "../utils/ApiError.js";

// The single source of truth for who may do what. Every protected route
// checks this map, and GET /api/auth/me (plus every login response) sends
// the caller's own permission list to the admin app, which derives its nav
// and button visibility from it - so there is no second copy to keep in
// sync anymore.
//
// Page visibility in the admin app maps onto these keys: Dashboard needs
// dashboard.read, Bookings booking.read, Support ticket.read, Refunds
// refund.read, Providers provider.read, Customers customer.read and
// Settings team.manage.
export const PERMISSIONS = {
  "dashboard.read": ["super_admin", "manager", "support_agent", "finance"],

  "booking.read": ["super_admin", "manager", "support_agent", "finance"],
  // Create bookings on a customer's behalf (e.g. phone orders).
  "booking.create": ["super_admin", "manager"],
  // Reschedule/edit details and move a job through started -> completed.
  "booking.update": ["super_admin", "manager"],
  // Reassign the provider or cancel the booking.
  "booking.reassign": ["super_admin", "manager"],

  "provider.read": ["super_admin", "manager"],
  "provider.manage": ["super_admin", "manager"],

  "customer.read": ["super_admin", "manager"],
  "customer.manage": ["super_admin", "manager"],

  "refund.read": ["super_admin", "manager", "support_agent", "finance"],
  "refund.request": ["super_admin", "manager", "support_agent", "finance"],
  "refund.approve": ["super_admin", "manager", "finance"],

  "ticket.read": ["super_admin", "manager", "support_agent"],
  "ticket.reply": ["super_admin", "manager", "support_agent"],
  "ticket.resolve": ["super_admin", "manager", "support_agent"],

  "team.manage": ["super_admin"],
};

export function hasPermission(role, action) {
  return (PERMISSIONS[action] ?? []).includes(role);
}

export function permissionsForRole(role) {
  return Object.keys(PERMISSIONS).filter((action) => hasPermission(role, action));
}

export function requirePermission(action) {
  if (!PERMISSIONS[action]) {
    // Fail loudly at boot rather than silently denying every request.
    throw new Error(`Unknown permission "${action}"`);
  }

  return function checkPermission(req, res, next) {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required", "AUTH_REQUIRED"));
    }

    if (!hasPermission(req.user.role, action)) {
      return next(new ApiError(403, "Insufficient permissions", "FORBIDDEN"));
    }

    next();
  };
}
