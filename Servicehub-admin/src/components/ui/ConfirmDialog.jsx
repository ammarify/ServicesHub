import { X } from "lucide-react";
import { useEffect } from "react";

export function ConfirmDialog({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="animate-overlay-enter fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="animate-dialog-enter w-full max-w-md rounded-card border border-border bg-surface p-5 shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="confirm-dialog-title" className="text-[15px] font-semibold text-text-primary">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-btn text-text-secondary transition-colors hover:bg-canvas active:translate-y-px"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-3 text-[13px] text-text-secondary">{children}</div>

        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
