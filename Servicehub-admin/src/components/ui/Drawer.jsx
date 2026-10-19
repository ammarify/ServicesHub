import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function Drawer({
  open,
  onClose,
  title,
  ariaLabel,
  children,
  widthClassName = "max-w-md",
  side = "right",
  padded = true,
}) {
  const [isMounted, setIsMounted] = useState(open);
  const [isVisible, setIsVisible] = useState(false);
  const panelRef = useRef(null);
  const isRight = side === "right";

  if (open && !isMounted) {
    setIsMounted(true);
  }

  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    const raf = requestAnimationFrame(() => setIsVisible(false));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Unmount after the slide-out. transitionend normally does it; this
  // covers the cases where no transition runs (e.g. closed before opening).
  useEffect(() => {
    if (open || !isMounted) return undefined;
    const timer = setTimeout(() => setIsMounted(false), 300);
    return () => clearTimeout(timer);
  }, [open, isMounted]);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Focus moves into the drawer when it opens and back to whatever opened
  // it when it closes.
  useEffect(() => {
    if (!open || !isMounted) return undefined;
    const previouslyFocused = document.activeElement;
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus({ preventScroll: true });
    };
  }, [open, isMounted]);

  if (!isMounted) return null;

  // Portaled to <body> so no transformed ancestor can trap the fixed overlay.
  return createPortal(
    <div
      className={clsx(
        "fixed inset-0 z-50 flex bg-black/50 backdrop-blur-[2px] transition-opacity duration-180",
        isRight ? "justify-end" : "justify-start",
        isVisible ? "opacity-100" : "opacity-0",
        !open && "pointer-events-none",
      )}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        tabIndex={-1}
        className={clsx(
          "flex h-full w-full flex-col bg-surface shadow-pop transition-transform duration-180 ease-out focus:outline-none",
          isRight ? "border-l border-border" : "border-r border-border",
          widthClassName,
          isVisible ? "translate-x-0" : isRight ? "translate-x-full" : "-translate-x-full",
        )}
        onTransitionEnd={(event) => {
          if (event.target === event.currentTarget && !open) setIsMounted(false);
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
    </div>,
    document.body
  );
}
