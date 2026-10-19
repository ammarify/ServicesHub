import clsx from "clsx";

export function Textarea({ className, rows = 3, ...props }) {
  return (
    <textarea
      rows={rows}
      className={clsx(
        "w-full resize-y rounded-card border border-border bg-surface px-3 py-2 text-[13px] leading-relaxed text-text-primary placeholder:text-text-secondary aria-[invalid=true]:border-danger",
        className
      )}
      {...props}
    />
  );
}
