import { ApiError } from "../utils/ApiError.js";

// Mirrors ../../../Servicehub-admin/src/lib/permissions.js.
//
// "*.read" entries reproduce NAV_VISIBILITY: a role can only read a
// resource here if it can see that resource's page in the frontend nav
// (e.g. `finance` has no `/customers` or `/providers` entry, so it gets
// no `customer.read` / `provider.read`). The API enforces this itself
// rather than trusting the frontend to hide the nav item, the same way
// AppLayout's route guard re-checks `canViewPath` for direct navigation.
//
// "booking.reassign", "refund.approve" and "team.manage" are copied
// directly from ACTION_PERMISSIONS. There is deliberately no separate
// "booking.cancel" key: the frontend gates both "Reassign provider" and
// "Cancel booking" behind the single `booking.reassign` action (see
// the frontend permission audit), so the cancel route below reuses that
// same key rather than inventing a permission the UI doesn't have.
//
// "ticket.reply" / "ticket.resolve" are listed for future ticket routes
// but, per the same audit, the frontend never gates them - anyone who
// can read tickets can reply/resolve. "refund.request" is similarly
// ungated in the UI (any staff member who can see refunds can file one);
// only the approve/reject decision is permission-checked.
const PERMISSIONS = {
  "dashboard.read": ["super_admin", "manager", "support_agent", "finance"],
  "booking.read": ["super_admin", "manager", "support_agent", "finance"],
  "booking.reassign": ["super_admin", "manager"],
  "provider.read": ["super_admin", "manager", "support_agent"],
  "customer.read": ["super_admin", "manager"],
  "refund.read": ["super_admin", "manager", "support_agent", "finance"],
  "refund.request": ["super_admin", "manager", "support_agent", "finance"],
  "refund.approve": ["super_admin", "manager", "finance"],
  "ticket.read": ["super_admin", "manager", "support_agent"],
  "ticket.reply": ["super_admin", "manager", "support_agent"],
  "ticket.resolve": ["super_admin", "manager", "support_agent"],
  "team.manage": ["super_admin"],
};

export function requirePermission(action) {
  return function checkPermission(req, res, next) {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required"));
    }

    const allowedRoles = PERMISSIONS[action] ?? [];
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, "Insufficient permissions"));
    }

    next();
  };
}
