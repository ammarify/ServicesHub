import clsx from "clsx";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";
import { Sparkline } from "./Sparkline";

const DELTA_CLASSES = {
  positive: "bg-success/10 text-success",
  negative: "bg-danger/10 text-danger",
  neutral: "bg-canvas text-text-secondary",
};

export function DeltaPill({ percent, tone }) {
  const Icon = !percent ? Minus : percent > 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className={clsx(
        "font-data inline-flex items-center gap-1 rounded-btn px-1.5 py-0.5 text-[11px] font-semibold",
        DELTA_CLASSES[tone]
      )}
    >
      <Icon size={12} aria-hidden="true" />
      <span className="sr-only">{percent > 0 ? "Up" : percent < 0 ? "Down" : "No change,"}</span>
      {Math.abs(percent ?? 0)}%
    </span>
  );
}

// A thin progress track (e.g. providers available out of the whole fleet).
function Meter({ value, max, label }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className="h-1.5 w-full overflow-hidden rounded-full bg-accent/15"
    >
      <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${percent}%` }} />
    </div>
  );
}

// Hairlines between cells: 1 column on phones, 2x2 from sm, 4 across from xl.
// (Named breakpoints only: mixing them with arbitrary min-[...] ones on the
// same property lets the smaller breakpoint win.)
const CELL_BORDERS = [
  "border-b sm:border-r xl:border-b-0",
  "border-b xl:border-b-0 xl:border-r",
  "border-b sm:border-b-0 sm:border-r",
  "",
];

function KpiCell({ icon: Icon, label, value, delta, context, trend, trendLabel, meter, isLoading, className }) {
  return (
    <div className={clsx("flex min-w-0 flex-col gap-3 border-border p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-[13px] text-text-secondary">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-btn bg-accent/10 text-accent">
            <Icon size={15} aria-hidden="true" />
          </span>
          <span className="truncate">{label}</span>
        </span>
        {!isLoading && delta}
      </div>

      {isLoading ? (
        <>
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3 w-32" />
        </>
      ) : (
        <>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="font-data truncate text-[24px] font-semibold leading-none text-text-primary">{value}</div>
              <div className="mt-2 truncate text-[12px] text-text-secondary">{context}</div>
            </div>
            {trend && <Sparkline values={trend} label={trendLabel} />}
          </div>
          {meter && <Meter {...meter} />}
        </>
      )}
    </div>
  );
}

// The dashboard's headline numbers as one strip: four cells divided by
// hairlines rather than four separate cards.
export function KpiStrip({ items, isLoading }) {
  return (
    <Card padded={false}>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item, index) => (
          <KpiCell key={item.label} {...item} isLoading={isLoading} className={CELL_BORDERS[index]} />
        ))}
      </div>
    </Card>
  );
}
