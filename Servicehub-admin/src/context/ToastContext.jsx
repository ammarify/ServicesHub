import clsx from "clsx";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);

const DURATION_MS = { success: 4500, info: 4500, error: 7000 };
const MAX_VISIBLE = 4;

const TONES = {
  success: { icon: CircleCheck, iconClass: "text-success", barClass: "bg-success" },
  error: { icon: CircleAlert, iconClass: "text-danger", barClass: "bg-danger" },
  info: { icon: Info, iconClass: "text-accent", barClass: "bg-accent" },
};

function ToastItem({ toast, onDismiss }) {
  const { icon: Icon, iconClass, barClass } = TONES[toast.tone];
  const duration = DURATION_MS[toast.tone];
  const [isPaused, setIsPaused] = useState(false);
  const remainingRef = useRef(duration);
  const startedAtRef = useRef(0);

  // Counts down only while the pointer isn't on the toast, so a message
  // being read never vanishes mid-sentence.
  useEffect(() => {
    if (isPaused) return undefined;
    startedAtRef.current = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id), remainingRef.current);
    return () => {
      clearTimeout(timer);
      remainingRef.current -= Date.now() - startedAtRef.current;
    };
  }, [isPaused, onDismiss, toast.id]);

  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      className="animate-dialog-enter pointer-events-auto relative overflow-hidden rounded-card border border-border bg-surface shadow-pop"
    >
      <div className="flex items-start gap-3 px-3.5 py-3">
        <Icon size={18} className={clsx("mt-px shrink-0", iconClass)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {toast.title && <p className="text-[13px] font-semibold text-text-primary">{toast.title}</p>}
          <p className={clsx("text-[13px] leading-relaxed", toast.title ? "text-text-secondary" : "text-text-primary")}>
            {toast.message}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-btn text-text-secondary transition-colors hover:bg-canvas hover:text-text-primary"
        >
          <X size={14} />
        </button>
      </div>
      <span
        aria-hidden="true"
        className={clsx("animate-toast-countdown absolute bottom-0 left-0 h-0.5 w-full opacity-60", barClass)}
        style={{ animationDuration: `${duration}ms`, animationPlayState: isPaused ? "paused" : "running" }}
      />
    </div>
  );
}

// Confirms that something happened (saved, deleted, sent) or explains why it
// didn't, for actions whose result has no natural place on the page.
//
//   toast.success("Booking BK-4853 updated.")
//   toast.error(message, { title: "Couldn't delete" })
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((tone, message, options = {}) => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((prev) => [...prev, { id, tone, message, title: options.title }].slice(-MAX_VISIBLE));
  }, []);

  const api = useMemo(
    () => ({
      success: (message, options) => show("success", message, options),
      error: (message, options) => show("error", message, options),
      info: (message, options) => show("info", message, options),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
