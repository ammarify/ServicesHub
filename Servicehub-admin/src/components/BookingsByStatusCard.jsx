import { formatNumber } from "../lib/formatters";
import { Card } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";

const STATUS_LABELS = {
  completed: "Completed",
  in_progress: "In progress",
  assigned: "Assigned",
  pending: "Pending",
  cancelled: "Cancelled",
};

const STATUS_COLORS = {
  completed: "bg-success",
  in_progress: "bg-info",
  assigned: "bg-accent",
  pending: "bg-warning",
  cancelled: "bg-danger",
};

// One row per status rather than one stacked bar: neighbouring status colours
// (amber/red, blue/cyan) are too close to tell apart side by side, and each
// row is labelled anyway.
export function BookingsByStatusCard({ data, isLoading, periodLabel }) {
  const total = data.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-text-primary">Bookings by status</h2>
          {periodLabel && <p className="mt-0.5 text-[12px] text-text-secondary">Scheduled {periodLabel.toLowerCase()}</p>}
        </div>
        {!isLoading && (
          <div className="text-right">
            <div className="font-data text-[20px] font-semibold leading-none text-text-primary">{formatNumber(total)}</div>
            <div className="mt-1 text-[11px] text-text-secondary">total</div>
          </div>
        )}
      </div>

      <ul className="mt-5 flex flex-1 flex-col justify-between gap-3.5">
        {isLoading ? (
          Array.from({ length: 5 }, (_, i) => (
            <li key={i}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-1.5 w-full" />
            </li>
          ))
        ) : total === 0 ? (
          <li className="flex flex-1 items-center justify-center py-6 text-center text-[13px] text-text-secondary">
            No bookings scheduled in this period.
          </li>
        ) : (
          data.map(({ status, count }) => {
            const share = Math.round((count / total) * 100);
            return (
              <li key={status}>
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="flex items-center gap-2 text-text-primary">
                    <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[status]}`} aria-hidden="true" />
                    {STATUS_LABELS[status]}
                  </span>
                  <span className="font-data text-text-primary">
                    {formatNumber(count)}
                    <span className="ml-2 inline-block w-9 text-right text-text-secondary">{share}%</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-canvas">
                  <div
                    className={`h-full rounded-full ${STATUS_COLORS[status]} transition-[width] duration-500`}
                    style={{ width: `${share}%` }}
                  />
                </div>
              </li>
            );
          })
        )}
      </ul>
    </Card>
  );
}
