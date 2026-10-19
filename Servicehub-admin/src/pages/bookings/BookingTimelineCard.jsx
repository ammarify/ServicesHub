import clsx from "clsx";
import {
  CalendarClock,
  CalendarPlus,
  CircleCheck,
  CircleDot,
  CircleX,
  Pencil,
  Play,
  UserRoundCheck,
  UserRoundCog,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { formatDateTime, relativeTime } from "../../lib/formatters";

// Each kind of event: what it's called, its icon and the tone of its marker.
const EVENTS = {
  created: { label: "Booking created", icon: CalendarPlus, tone: "accent" },
  assigned: { label: "Provider assigned", icon: UserRoundCheck, tone: "accent" },
  reassigned: { label: "Provider reassigned", icon: UserRoundCog, tone: "warning" },
  started: { label: "Service started", icon: Play, tone: "info" },
  completed: { label: "Service completed", icon: CircleCheck, tone: "success" },
  cancelled: { label: "Booking cancelled", icon: CircleX, tone: "danger" },
  rescheduled: { label: "Booking rescheduled", icon: CalendarClock, tone: "warning" },
  updated: { label: "Details updated", icon: Pencil, tone: "neutral" },
};

const TONE_CLASSES = {
  accent: "bg-accent/10 text-accent",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  neutral: "bg-canvas text-text-secondary",
};

// Rescheduling notes carry ISO timestamps; show them in the viewer's time.
function readableNote(entry) {
  if (!entry.note) return null;
  if (entry.event === "rescheduled") {
    const [from, to] = entry.note.replace("Moved from ", "").split(" to ");
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (!Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime())) {
      return `Moved from ${formatDateTime(fromDate)} to ${formatDateTime(toDate)}`;
    }
  }
  return entry.note;
}

export function BookingTimelineCard({ timeline, isLoading }) {
  // Oldest first, as it happened (the progress steps read the same way).
  const entries = [...timeline].sort((a, b) => new Date(a.at) - new Date(b.at));

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-text-primary">Activity</h2>
        {!isLoading && (
          <span className="text-[12px] text-text-secondary">
            <span className="font-data">{entries.length}</span> {entries.length === 1 ? "event" : "events"}
          </span>
        )}
      </div>

      <ol className="mt-4 flex flex-col">
        {isLoading
          ? Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="flex gap-3 pb-5 last:pb-0">
                <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                <div className="flex-1 pt-1">
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="mt-2 h-3 w-48" />
                </div>
              </li>
            ))
          : entries.map((entry, index) => {
              const event = EVENTS[entry.event] ?? { label: entry.event, icon: CircleDot, tone: "neutral" };
              const note = readableNote(entry);
              const isLast = index === entries.length - 1;
              return (
                <li key={`${entry.event}-${entry.at}-${index}`} className={clsx("relative flex gap-3", !isLast && "pb-5")}>
                  {!isLast && <span aria-hidden="true" className="absolute bottom-0 left-[13px] top-8 w-px bg-border" />}
                  <span
                    aria-hidden="true"
                    className={clsx(
                      "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      TONE_CLASSES[event.tone]
                    )}
                  >
                    <event.icon size={14} />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-[13px] font-medium text-text-primary">{event.label}</span>
                      <span className="font-data text-[11px] text-text-secondary">{relativeTime(entry.at)}</span>
                    </div>
                    {note && <p className="mt-0.5 text-[12px] leading-relaxed text-text-secondary">{note}</p>}
                    <div className="mt-0.5 text-[12px] text-text-secondary">
                      <span className="font-data">{formatDateTime(entry.at)}</span>
                      {entry.actor && <> · by {entry.actor}</>}
                    </div>
                  </div>
                </li>
              );
            })}
      </ol>
    </Card>
  );
}
