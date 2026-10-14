import clsx from "clsx";

export function Card({ className, children, padded = true }) {
  return (
    <div
      className={clsx(
        "rounded-card border border-border bg-surface shadow-card",
        padded && "p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
