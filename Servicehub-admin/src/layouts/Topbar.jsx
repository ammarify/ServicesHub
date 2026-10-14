import { Bell, ChevronDown, Menu } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { useNotifications } from "../context/NotificationContext";
import { getPageTitle } from "./navigation";

export function Topbar({ onMenuClick }) {
  const location = useLocation();
  const title = getPageTitle(location.pathname);
  const { newTicketCount } = useNotifications();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-canvas px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="flex h-7 w-7 items-center justify-center rounded-btn text-text-secondary hover:bg-surface md:hidden"
        >
          <Menu size={16} />
        </button>
        <h1 className="text-[20px] font-semibold text-text-primary">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-7 w-7 items-center justify-center rounded-btn text-text-secondary hover:bg-surface"
        >
          <Bell size={16} />
          {newTicketCount > 0 && (
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-danger" />
          )}
        </button>

        <Button variant="secondary">
          This Week
          <ChevronDown size={14} className="text-text-secondary" />
        </Button>
      </div>
    </header>
  );
}
