import clsx from "clsx";

export function Select({ className, children, ...props }) {
  return (
    <select
      className={clsx(
        "h-9 w-full rounded-card border border-border bg-surface px-3 text-[13px] text-text-primary aria-[invalid=true]:border-danger",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
