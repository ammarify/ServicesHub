import clsx from "clsx";

export function Checkbox({ label, className, ...props }) {
  return (
    <label className={clsx("flex items-center gap-2 text-[13px] text-text-secondary", className)}>
      <input
        type="checkbox"
        style={{ accentColor: "var(--color-accent)" }}
        className="h-3.5 w-3.5 rounded-sm"
        {...props}
      />
      {label}
    </label>
  );
}
