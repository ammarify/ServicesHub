import { Menu, Search } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useCommandPalette } from "../context/CommandPaletteContext";
import { getPageTitle } from "./navigation";
import { NotificationsMenu } from "./NotificationsMenu";
import { RangePicker } from "./RangePicker";

export function Topbar({ onMenuClick }) {
  const location = useLocation();
  const { openPalette } = useCommandPalette();
  const title = getPageTitle(location.pathname);
  const isDashboard = location.pathname === "/dashboard";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-canvas px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          data-tour="menu-button"
          className="flex h-7 w-7 items-center justify-center rounded-btn text-text-secondary hover:bg-surface md:hidden"
        >
          <Menu size={16} />
        </button>
        <h1 className="truncate text-[20px] font-semibold text-text-primary">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* The sidebar's search box only shows from lg; below that, search
            lives here. */}
        <button
          type="button"
          onClick={openPalette}
          aria-label="Search"
          className="flex h-8 w-8 items-center justify-center rounded-btn text-text-secondary transition-colors hover:bg-surface hover:text-text-primary lg:hidden"
        >
          <Search size={16} />
        </button>
        <NotificationsMenu />
        {isDashboard && <RangePicker />}
      </div>
    </header>
  );
}
