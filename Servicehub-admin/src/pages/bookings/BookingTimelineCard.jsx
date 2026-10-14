import clsx from "clsx";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { formatDateTime } from "../../lib/formatters";

const EVENT_LABELS = {
  created: "Booking created",
  assigned: "Provider assigned",
  started: "Service started",
  completed: "Service completed",
  cancelled: "Booking cancelled",
};

function dotClass(event) {
  if (event === "completed") return "bg-success";
  if (event === "cancelled") return "bg-danger";
  return "bg-text-secondary";
}

export function BookingTimelineCard({ timeline, isLoading }) {
  return (
    <Card>
      <div className="text-[15px] font-semibold text-text-primary">Timeline</div>

      <div className="mt-4 flex flex-col">
        {isLoading
          ? Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex gap-3 pb-6 last:pb-0">
                <Skeleton className="h-2 w-2 shrink-0 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="mt-2 h-3 w-24" />
                </div>
              </div>
            ))
          : timeline.map((entry, index) => (
              <div key={`${entry.event}-${entry.at}`} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={clsx("h-2 w-2 shrink-0 rounded-full", dotClass(entry.event))} />
                  {index < timeline.length - 1 && <span className="w-px flex-1 bg-border" />}
                </div>
                <div className={index < timeline.length - 1 ? "pb-6" : ""}>
                  <div className="text-[13px] text-text-primary">
                    {EVENT_LABELS[entry.event] ?? entry.event}
                  </div>
                  <div className="font-data mt-0.5 text-[11px] text-text-secondary">
                    {formatDateTime(entry.at)}
                  </div>
                </div>
              </div>
            ))}
      </div>
    </Card>
  );
}
