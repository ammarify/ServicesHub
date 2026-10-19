import clsx from "clsx";
import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CommandPaletteProvider } from "../context/CommandPaletteContext";
import { TourProvider } from "../context/TourContext";
import { canViewPath } from "../lib/permissions";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { ForbiddenPage } from "../pages/errors/ForbiddenPage";
import { getPageTitle } from "./navigation";
import { RealtimeBridge } from "./RealtimeBridge";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

const FULL_WIDTH_PATHS = ["/support"];

export function AppLayout() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  useDocumentTitle(getPageTitle(location.pathname));

  // Every route is permission-checked here, not just hidden from the nav,
  // so typing a URL the role can't use shows "Access denied". "/" is only a
  // redirect to /dashboard.
  const isAllowed = location.pathname === "/" || canViewPath(user, location.pathname);
  const isFullWidth = isAllowed && FULL_WIDTH_PATHS.some((path) => location.pathname.startsWith(path));
  const content = isAllowed ? <Outlet /> : <ForbiddenPage />;

  return (
    <TourProvider>
      <CommandPaletteProvider>
        {/* The window never scrolls, only <main>: `relative` + overflow-hidden
            also catch anything absolutely positioned that would otherwise
            stretch the page past the window. */}
        <div className="relative flex h-dvh overflow-hidden bg-canvas text-text-primary">
          <RealtimeBridge />

          <a
            href="#main-content"
            className="sr-only z-50 rounded-btn bg-surface px-3 py-2 text-[13px] text-text-primary focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
          >
            Skip to content
          </a>

          <Sidebar isOpen={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} />

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <Topbar onMenuClick={() => setIsMobileNavOpen(true)} />

            <main
              id="main-content"
              tabIndex={-1}
              className={clsx("flex-1 focus:outline-none", isFullWidth ? "overflow-hidden" : "overflow-y-auto")}
            >
              {isFullWidth ? (
                <div key={location.pathname} className="animate-page-enter h-full">
                  {content}
                </div>
              ) : (
                <div key={location.pathname} className="animate-page-enter mx-auto max-w-300 p-4 sm:p-6">
                  {content}
                </div>
              )}
            </main>
          </div>
        </div>
      </CommandPaletteProvider>
    </TourProvider>
  );
}
