import clsx from "clsx";

export function Logo({ size = 28, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 30 30"
      fill="none"
      className={clsx("shrink-0 text-accent", className)}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="16" height="16" rx="4" fill="currentColor" />
      <rect x="12" y="12" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
