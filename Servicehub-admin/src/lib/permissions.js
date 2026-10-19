// Permission checks for UI visibility only - the API enforces every one of
// these itself. The signed-in user's permission list comes from the API
// (GET /auth/me and every login response), generated from
// servihub-api/src/middleware/rbac.js, so there is no second copy of the
// role matrix to keep in sync here.

export function can(user, permission) {
  return Boolean(user?.permissions?.includes(permission));
}

// Which permission each top-level page needs. Pages not listed (e.g. the
// personal /account page) are open to every signed-in user.
export const PAGE_PERMISSIONS = {
  "/dashboard": "dashboard.read",
  "/bookings": "booking.read",
  "/support": "ticket.read",
  "/refunds": "refund.read",
  "/providers": "provider.read",
  "/customers": "customer.read",
  "/settings": "team.manage",
};

// Prefix match, so "/bookings/64f..." is checked against "/bookings".
export function canViewPath(user, path) {
  const page = Object.keys(PAGE_PERMISSIONS).find((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  if (!page) return true;
  return can(user, PAGE_PERMISSIONS[page]);
}
