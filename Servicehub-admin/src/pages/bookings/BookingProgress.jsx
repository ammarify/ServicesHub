import clsx from "clsx";
import { Check, X } from "lucide-react";
import { formatDayTime } from "../../lib/formatters";

const STEPS = [
  { key: "created", label: "Booked", events: ["created"] },
  { key: "assigned", label: "Assigned", events: ["assigned", "reassigned"] },
  { key: "started", label: "In progress", events: ["started"] },
  { key: "completed", label: "Completed", events: ["completed"] },
];
const CANCELLED_STEP = { key: "cancelled", label: "Cancelled", events: ["cancelled"] };

// The last step each live status has reached.
const REACHED = { pending: 0, assigned: 1, in_progress: 2, completed: 3 };

function stepTime(timeline, step, booking) {
  const match = timeline.findLast((entry) => step.events.includes(entry.event));
  if (match) return match.at;
  return step.key === "created" ? booking.createdAt : null;
}

const CIRCLE_CLASSES = {
  done: "bg-accent text-white",
  finished: "bg-success text-white",
  active: "bg-accent text-white ring-4 ring-accent/15",
  next: "border-2 border-accent bg-surface",
  upcoming: "border-2 border-border bg-surface",
  cancelled: "bg-danger text-white",
};

// Where a booking stands in its life: booked → assigned → in progress →
// completed, or the point at which it was cancelled.
export function BookingProgress({ booking }) {
  const timeline = [...(booking.timeline ?? [])].sort((a, b) => new Date(a.at) - new Date(b.at));
  const isCancelled = booking.status === "cancelled";

  let reached = REACHED[booking.status] ?? 0;
  if (isCancelled) {
    reached = 0;
    STEPS.forEach((step, index) => {
      if (step.key !== "created" && stepTime(timeline, step, booking)) reached = index;
    });
  }
  const steps = isCancelled ? [...STEPS.slice(0, reached + 1), CANCELLED_STEP] : STEPS;

  function stateOf(step, index) {
    if (step.key === "cancelled") return "cancelled";
    if (booking.status === "completed") return "finished";
    if (booking.status === "in_progress" && step.key === "started") return "active";
    if (index <= reached) return "done";
    if (index === reached + 1 && !isCancelled) return "next";
    return "upcoming";
  }

  return (
    <ol
      aria-label="Booking progress"
      className="grid"
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((step, index) => {
        const state = stateOf(step, index);
        const at = state === "upcoming" || state === "next" ? null : stepTime(timeline, step, booking);
        const nextState = index < steps.length - 1 ? stateOf(steps[index + 1], index + 1) : null;
        const lineIsReached = nextState && nextState !== "next" && nextState !== "upcoming";

        return (
          <li key={step.key} className="relative flex flex-col items-center text-center" aria-current={state === "active" ? "step" : undefined}>
            {nextState && (
              <span
                aria-hidden="true"
                className={clsx(
                  "absolute left-[calc(50%+18px)] right-[calc(-50%+18px)] top-3 h-0.5 rounded-full",
                  lineIsReached
                    ? nextState === "cancelled"
                      ? "bg-danger/40"
                      : nextState === "finished"
                        ? "bg-success"
                        : "bg-accent"
                    : "bg-border"
                )}
              />
            )}
            <span
              className={clsx("relative flex h-6 w-6 items-center justify-center rounded-full", CIRCLE_CLASSES[state])}
              aria-hidden="true"
            >
              {(state === "done" || state === "finished") && <Check size={13} strokeWidth={3} />}
              {state === "cancelled" && <X size={13} strokeWidth={3} />}
              {state === "active" && <span className="h-2 w-2 rounded-full bg-white" />}
            </span>
            <span
              className={clsx(
                "mt-2 text-[12px] font-medium sm:text-[13px]",
                state === "upcoming" ? "text-text-secondary" : state === "cancelled" ? "text-danger" : "text-text-primary"
              )}
            >
              {step.label}
              <span className="sr-only">
                {state === "upcoming" || state === "next" ? ", not yet" : state === "active" ? ", happening now" : ", done"}
              </span>
            </span>
            <span className="font-data mt-0.5 hidden text-[11px] text-text-secondary sm:block">
              {at ? formatDayTime(at) : state === "next" ? "Next" : "\u00a0"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
