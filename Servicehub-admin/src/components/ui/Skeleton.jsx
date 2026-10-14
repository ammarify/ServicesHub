import clsx from "clsx";

export function Skeleton({ className }) {
  return <div className={clsx("animate-pulse rounded-btn bg-border", className)} />;
}
