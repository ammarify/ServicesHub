import { Link } from "react-router-dom";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";

// A dashboard card listing a few recent records, with a link to the full page.
export function ListCard({ title, subtitle, viewAllTo, viewAllLabel = "View all", isLoading, isEmpty, emptyText, children }) {
  return (
    <Card padded={false} className="flex flex-col">
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div>
          <h2 className="text-[15px] font-semibold text-text-primary">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[12px] text-text-secondary">{subtitle}</p>}
        </div>
        {viewAllTo && (
          <Link to={viewAllTo} className="shrink-0 rounded-btn text-[13px] font-medium text-accent hover:underline">
            {viewAllLabel}
          </Link>
        )}
      </div>

      <div className="flex flex-col pb-2">
        {isLoading ? (
          Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-3 w-14" />
            </div>
          ))
        ) : isEmpty ? (
          <p className="px-5 py-8 text-center text-[13px] text-text-secondary">{emptyText}</p>
        ) : (
          children
        )}
      </div>
    </Card>
  );
}

// One row: leading visual, two lines of text, trailing details. Rendered as a
// link so the whole row opens the record.
export function ListRow({ to, leading, title, meta, trailing }) {
  return (
    <Link
      to={to}
      className="mx-2 flex items-center gap-3 rounded-btn px-3 py-2.5 text-[13px] transition-colors hover:bg-canvas"
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-text-primary">{title}</span>
        <span className="mt-0.5 block truncate text-[12px] text-text-secondary">{meta}</span>
      </span>
      <span className="flex shrink-0 items-center gap-3">{trailing}</span>
    </Link>
  );
}
