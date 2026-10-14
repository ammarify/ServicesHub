import { LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "../components/ui/Avatar";
import { useAuth } from "../context/AuthContext";

export function UserMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 min-w-[160px] rounded-card border border-border bg-surface p-1 shadow-card">
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-btn px-2.5 py-2 text-left text-[13px] text-danger transition-colors hover:bg-canvas"
          >
            <LogOut size={14} />
            Log out
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center gap-2.5 rounded-btn px-2.5 py-2 transition-colors hover:bg-canvas md:justify-center lg:justify-start"
      >
        <Avatar name={user.name} size={28} />
        <div className="min-w-0 text-left md:hidden lg:block">
          <div className="truncate text-[13px] font-medium text-text-primary">
            {user.name}
          </div>
          <div className="font-data text-[10px] uppercase text-text-secondary">
            {user.role}
          </div>
        </div>
      </button>
    </div>
  );
}
