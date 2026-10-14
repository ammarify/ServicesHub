import {
  CalendarCheck,
  LayoutDashboard,
  LifeBuoy,
  Settings,
  Undo2,
  Users,
  Wrench,
} from "lucide-react";

export const NAV_GROUPS = [
  {
    label: "Operations",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/bookings", label: "Bookings", icon: CalendarCheck },
      { to: "/support", label: "Support", icon: LifeBuoy },
      { to: "/refunds", label: "Refunds", icon: Undo2 },
    ],
  },
  {
    label: "Directory",
    items: [
      { to: "/providers", label: "Providers", icon: Wrench },
      { to: "/customers", label: "Customers", icon: Users },
    ],
  },
  {
    label: "System",
    items: [{ to: "/settings", label: "Settings", icon: Settings }],
  },
];

export function getPageTitle(pathname) {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.to || pathname.startsWith(`${item.to}/`)) {
        return item.label;
      }
    }
  }
  return "ServiHub Admin";
}
