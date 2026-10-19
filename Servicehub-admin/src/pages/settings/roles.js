export const ROLE_OPTIONS = [
  {
    value: "super_admin",
    label: "Super Admin",
    description: "Everything, including team management.",
  },
  {
    value: "manager",
    label: "Manager",
    description: "Operations, support, refunds and the provider/customer directories.",
  },
  {
    value: "support_agent",
    label: "Support Agent",
    description: "Support center, bookings (read-only) and refund requests.",
  },
  {
    value: "finance",
    label: "Finance",
    description: "Bookings (read-only) and refund approvals.",
  },
];

export function roleLabel(role) {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}
