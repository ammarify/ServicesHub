import clsx from "clsx";
import { Moon, Sun } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Logo } from "../components/ui/Logo";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useRefunds } from "../hooks/useRefunds";
import { useTickets } from "../hooks/useTickets";
import { formatNumber } from "../lib/formatters";
import { can, canViewPath } from "../lib/permissions";
import { NAV_GROUPS } from "./navigation";
import { SidebarSearch } from "./SidebarSearch";
import { UserMenu } from "./UserMenu";

// What's waiting on a page, shown beside its link: new tickets nobody has
// picked up and refunds waiting for a decision. Both stay current through
// the realtime invalidations in RealtimeBridge.
function useNavCounts(user) {
  const openTickets = useTickets({ status: "open", limit: 1 }, { enabled: can(user, "ticket.read") });
  const pendingRefunds = useRefunds({ status: "pending", limit: 1 }, { enabled: can(user, "refund.read") });
  return {
    "/support": { count: openTickets.data?.total ?? 0, label: "open tickets" },
    "/refunds": { count: pendingRefunds.data?.counts?.pending ?? 0, label: "refunds waiting for a decision" },
  };
}

function NavCount({ count, label, isActive }) {
  if (!count) return null;
  return (
    <>
      <span
        aria-hidden="true"
        className={clsx(
          "font-data ml-auto min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 md:hidden lg:inline-block",
          isActive ? "bg-accent text-white" : "bg-accent/10 text-accent"
        )}
      >
        {count > 99 ? "99+" : formatNumber(count)}
      </span>
      {/* Icon-only sidebar (md): a dot instead of the number. */}
      <span aria-hidden="true" className="absolute right-2 top-1.5 hidden h-1.5 w-1.5 rounded-full bg-accent md:block lg:hidden" />
      <span className="sr-only">
        , {formatNumber(count)} {label}
      </span>
    </>
  );
}

export function Sidebar({ isOpen, onClose }) {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const counts = useNavCounts(user);

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canViewPath(user, item.to)),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-surface transition-transform duration-200 md:static md:z-auto md:w-16 md:translate-x-0 lg:w-60",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4 md:justify-center lg:justify-start">
          <Logo size={28} />
          <span className="text-[13px] font-semibold text-text-primary md:hidden lg:inline">
            ServiHub
          </span>
        </div>

        <div className="border-b border-border p-3 md:hidden lg:block" data-tour="search">
          <SidebarSearch onNavigate={onClose} />
        </div>

        <nav aria-label="Main" className="flex-1 space-y-4 overflow-y-auto p-3" data-tour="nav">
          {visibleGroups.map((group) => (
            <div key={group.label}>
              <div className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-secondary md:hidden lg:block">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    title={item.label}
                    data-tour={`nav-${item.to}`}
                    className={({ isActive }) =>
                      clsx(
                        "relative flex items-center gap-2.5 rounded-btn px-2.5 py-2 text-[13px] transition-colors md:justify-center lg:justify-start",
                        isActive
                          ? "bg-accent/10 font-medium text-accent"
                          : "text-text-secondary hover:bg-canvas hover:text-text-primary",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* A short accent bar marks the current page. */}
                        {isActive && (
                          <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" />
                        )}
                        <item.icon size={16} className="shrink-0" />
                        <span className="md:hidden lg:inline">{item.label}</span>
                        {counts[item.to] && <NavCount {...counts[item.to]} isActive={isActive} />}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-border p-3">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            data-tour="theme"
            className="flex w-full items-center gap-2.5 rounded-btn px-2.5 py-2 text-[13px] text-text-secondary transition-colors hover:bg-canvas hover:text-text-primary md:justify-center lg:justify-start"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            <span className="md:hidden lg:inline">
              {theme === "dark" ? "Light" : "Dark"}
            </span>
          </button>

          <div className="mt-2">
            <UserMenu onNavigate={onClose} />
          </div>
        </div>
      </aside>
    </>
  );
}
