import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

// Centered modal. With `onSubmit`, the body and footer become one <form>, so
// Enter submits and the footer's type="submit" button triggers it.
//
// Rendered into document.body through a portal: an ancestor with a CSS
// transform (a sliding Drawer, a page-enter animation) would otherwise
// become the containing block for this fixed overlay and squeeze it.
const ICON_TONE_CLASSES = {
  default: "bg-accent/10 text-accent",
  danger: "bg-danger/10 text-danger",
  warning: "bg-warning/10 text-warning",
};

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  onSubmit,
  icon: Icon,
  tone = "default",
  widthClassName = "max-w-md",
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef(null);

  // Move focus into the dialog when it opens (first field, else the panel),
  // and give it back to whatever opened it when it closes.
  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    const firstField = panel?.querySelector("input:not([type=hidden]), select, textarea");
    (firstField ?? panel)?.focus({ preventScroll: true });
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  const body = (
    <>
      {children && <div className={clsx("mt-3 text-[13px] text-text-secondary", Icon && "sm:pl-12")}>{children}</div>}
      {footer && <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>}
    </>
  );

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(event);
  }

  return createPortal(
    <div
      className="animate-overlay-enter fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        // Escape is handled here (focus is always inside the dialog) and
        // stopped, so a drawer underneath doesn't close along with it.
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
        className={clsx(
          "animate-dialog-enter max-h-[calc(100vh-2rem)] w-full overflow-y-auto rounded-card border border-border bg-surface p-5 shadow-pop focus:outline-none",
          widthClassName
        )}
      >
        <div className="flex items-start justify-between gap-3">
          {Icon && (
            <span
              className={clsx(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                ICON_TONE_CLASSES[tone] ?? ICON_TONE_CLASSES.default
              )}
              aria-hidden="true"
            >
              <Icon size={17} />
            </span>
          )}
          <div className={clsx("min-w-0 flex-1", Icon && "pt-1.5")}>
            <h2 id={titleId} className="text-[15px] font-semibold text-text-primary">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-[13px] text-text-secondary">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-btn text-text-secondary transition-colors hover:bg-canvas active:translate-y-px"
          >
            <X size={16} />
          </button>
        </div>

        {onSubmit ? (
          <form onSubmit={handleSubmit} noValidate>
            {body}
          </form>
        ) : (
          body
        )}
      </div>
    </div>,
    document.body
  );
}
