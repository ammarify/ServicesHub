import clsx from "clsx";
import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { canViewPath } from "../lib/permissions";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { ForbiddenPage } from "../pages/errors/ForbiddenPage";
import { getPageTitle } from "./navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

const FULL_WIDTH_PATHS = ["/support"];

export function AppLayout() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  useDocumentTitle(getPageTitle(location.pathname));

  // "/" is just a redirect stub to /dashboard (see App.jsx) — every role can
  // reach /dashboard, so it's exempt rather than being checked literally.
  const isAllowed = location.pathname === "/" || canViewPath(user.role, location.pathname);
  const isFullWidth = isAllowed && FULL_WIDTH_PATHS.some((path) => location.pathname.startsWith(path));
  const content = isAllowed ? <Outlet /> : <ForbiddenPage />;

  return (
    <div className="flex h-screen bg-canvas text-text-primary">
      <Sidebar
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setIsMobileNavOpen(true)} />

        <main className={clsx("flex-1", isFullWidth ? "overflow-hidden" : "overflow-y-auto")}>
          {isFullWidth ? (
            <div key={location.pathname} className="animate-page-enter h-full">
              {content}
            </div>
          ) : (
            <div key={location.pathname} className="animate-page-enter mx-auto max-w-300 p-6">
              {content}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
