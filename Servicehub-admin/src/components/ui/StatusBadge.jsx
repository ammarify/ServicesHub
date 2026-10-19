import clsx from "clsx";

const STATUS_TONE = {
  pending: "warning",
  assigned: "info",
  in_progress: "info",
  completed: "success",
  cancelled: "danger",
  open: "warning",
  resolved: "success",
  approved: "success",
  rejected: "danger",
  low: "success",
  medium: "warning",
  high: "danger",
  available: "success",
  off_duty: "warning",
  calm: "success",
  neutral: "info",
  frustrated: "warning",
  angry: "danger",
  active: "success",
  disabled: "danger",
  invited: "warning",
  verified: "success",
  unverified: "warning",
};

const DOT_CLASSES = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

const TEXT_CLASSES = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
};

export function StatusBadge({ status }) {
  const tone = STATUS_TONE[status] ?? "info";

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASSES[tone])} />
      <span className={clsx("font-data text-[11px] uppercase tracking-wide", TEXT_CLASSES[tone])}>
        {/* "in_progress" reads as IN PROGRESS, not IN_PROGRESS */}
        {String(status ?? "").replace(/_/g, " ")}
      </span>
    </span>
  );
}
