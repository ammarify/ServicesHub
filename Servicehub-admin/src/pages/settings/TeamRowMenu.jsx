import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function TeamRowMenu({ member, onChangeRole, onToggleStatus }) {
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
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Row actions"
        className="flex h-7 w-7 items-center justify-center rounded-btn text-text-secondary hover:bg-canvas"
      >
        <MoreHorizontal size={16} />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-10 mt-1 min-w-[160px] rounded-card border border-border bg-surface p-1 shadow-card">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onChangeRole();
            }}
            className="flex w-full items-center rounded-btn px-2.5 py-2 text-left text-[13px] text-text-primary hover:bg-canvas"
          >
            Change role
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onToggleStatus();
            }}
            className="flex w-full items-center rounded-btn px-2.5 py-2 text-left text-[13px] text-danger hover:bg-canvas"
          >
            {member.status === "active" ? "Disable" : "Enable"}
          </button>
        </div>
      )}
    </div>
  );
}
