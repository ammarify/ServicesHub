const NAV_VISIBILITY = {
  super_admin: ["/dashboard", "/bookings", "/support", "/refunds", "/providers", "/customers", "/settings"],
  manager: ["/dashboard", "/bookings", "/support", "/refunds", "/providers", "/customers"],
  support_agent: ["/dashboard", "/bookings", "/support", "/refunds"],
  finance: ["/dashboard", "/bookings", "/refunds"],
};

export function canViewPath(role, path) {
  const allowed = NAV_VISIBILITY[role] ?? [];
  return allowed.some((allowedPath) => path === allowedPath || path.startsWith(`${allowedPath}/`));
}

const ACTION_PERMISSIONS = {
  "refund.approve": ["super_admin", "manager", "finance"],
  "booking.reassign": ["super_admin", "manager"],
  "team.manage": ["super_admin"],
};

export function can(role, action) {
  return ACTION_PERMISSIONS[action]?.includes(role) ?? false;
}
