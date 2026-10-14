import clsx from "clsx";
import { Card } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";

const DELTA_CLASSES = {
  positive: "text-success",
  negative: "text-danger",
  neutral: "text-text-secondary",
};

export function StatCard({ label, value, deltaLabel, deltaTone = "neutral", isLoading }) {
  if (isLoading) {
    return (
      <Card>
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-3 h-7 w-24" />
        <Skeleton className="mt-2 h-3 w-28" />
      </Card>
    );
  }

  return (
    <Card>
      <div className="text-[12px] text-text-secondary">{label}</div>
      <div className="font-data mt-1.5 text-[22px] font-semibold text-text-primary">
        {value}
      </div>
      <div className={clsx("mt-1.5 text-[11px]", DELTA_CLASSES[deltaTone])}>{deltaLabel}</div>
    </Card>
  );
}
