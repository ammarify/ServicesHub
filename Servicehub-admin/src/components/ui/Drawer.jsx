import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

export function Drawer({
  open,
  onClose,
  title,
  children,
  widthClassName = "max-w-md",
  side = "right",
  padded = true,
}) {
  const [isMounted, setIsMounted] = useState(open);
  const [isVisible, setIsVisible] = useState(false);
  const isRight = side === "right";

  useEffect(() => {
    if (open) {
      setIsMounted(true);
      const raf = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setIsVisible(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!isMounted) return null;

  return (
    <div
      className={clsx(
        "fixed inset-0 z-50 flex bg-black/50 transition-opacity duration-180",
        isRight ? "justify-end" : "justify-start",
        isVisible ? "opacity-100" : "opacity-0",
      )}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          "flex h-full w-full flex-col bg-surface shadow-card transition-transform duration-180 ease-out",
          isRight ? "border-l border-border" : "border-r border-border",
          widthClassName,
          isVisible ? "translate-x-0" : isRight ? "translate-x-full" : "-translate-x-full",
        )}
        onClick={(event) => event.stopPropagation()}
        onTransitionEnd={() => {
          if (!open) setIsMounted(false);
        }}
      >
        {title && (
          <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-[15px] font-semibold text-text-primary">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-btn text-text-secondary transition-colors hover:bg-canvas active:translate-y-px"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className={clsx("flex-1 overflow-y-auto", padded && "p-5")}>{children}</div>
      </div>
    </div>
  );
}
