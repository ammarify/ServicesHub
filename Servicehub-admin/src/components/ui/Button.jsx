import clsx from "clsx";

const VARIANT_TONE_CLASSES = {
  primary: {
    default: "bg-accent text-white hover:brightness-110",
    danger: "bg-danger text-white hover:brightness-110",
  },
  secondary: {
    default: "border border-border bg-surface text-text-primary hover:bg-canvas",
    danger: "border border-danger/40 bg-surface text-danger hover:bg-danger/10",
  },
  ghost: {
    default: "bg-transparent text-text-secondary hover:bg-canvas hover:text-text-primary",
    danger: "bg-transparent text-danger hover:bg-danger/10",
  },
};

export function Button({ variant = "secondary", tone = "default", className, children, ...props }) {
  return (
    <button
      type="button"
      className={clsx(
        "inline-flex h-[34px] items-center gap-2 rounded-btn px-3 text-[13px] font-medium transition-colors active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
        VARIANT_TONE_CLASSES[variant][tone],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
