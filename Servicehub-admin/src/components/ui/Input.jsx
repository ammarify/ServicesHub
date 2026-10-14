import clsx from "clsx";

export function Input({ className, ...props }) {
  return (
    <input
      className={clsx(
        "h-9 w-full rounded-card border border-border bg-surface px-3 text-[13px] text-text-primary placeholder:text-text-secondary",
        className,
      )}
      {...props}
    />
  );
}
