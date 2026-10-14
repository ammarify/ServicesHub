import clsx from "clsx";
import { Moon, Sun } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Logo } from "../components/ui/Logo";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { canViewPath } from "../lib/permissions";
import { NAV_GROUPS } from "./navigation";
import { SidebarSearch } from "./SidebarSearch";
import { UserMenu } from "./UserMenu";

export function Sidebar({ isOpen, onClose }) {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canViewPath(user.role, item.to)),
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

        <div className="border-b border-border p-3 md:hidden lg:block">
          <SidebarSearch />
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
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
                    className={({ isActive }) =>
                      clsx(
                        "flex items-center gap-2.5 rounded-btn px-2.5 py-2 text-[13px] transition-colors md:justify-center lg:justify-start",
                        isActive
                          ? "bg-accent/10 text-accent"
                          : "text-text-secondary hover:bg-canvas hover:text-text-primary",
                      )
                    }
                  >
                    <item.icon size={16} className="shrink-0" />
                    <span className="md:hidden lg:inline">{item.label}</span>
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
            className="flex w-full items-center gap-2.5 rounded-btn px-2.5 py-2 text-[13px] text-text-secondary transition-colors hover:bg-canvas hover:text-text-primary md:justify-center lg:justify-start"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            <span className="md:hidden lg:inline">
              {theme === "dark" ? "Light" : "Dark"}
            </span>
          </button>

          <div className="mt-2">
            <UserMenu />
          </div>
        </div>
      </aside>
    </>
  );
}
