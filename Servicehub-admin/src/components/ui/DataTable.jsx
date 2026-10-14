import clsx from "clsx";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Skeleton } from "./Skeleton";

export function DataTable({
  columns,
  data,
  getRowKey,
  getRowClassName,
  onRowClick,
  sortKey,
  sortDirection,
  onSortChange,
  isLoading,
  emptyState,
  skeletonRowCount = 8,
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={col.sortable ? () => onSortChange(col.key) : undefined}
                className={clsx(
                  "h-10 whitespace-nowrap px-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary",
                  col.align === "right" ? "text-right" : "text-left",
                  col.sortable && "cursor-pointer select-none hover:text-text-primary",
                )}
              >
                <span
                  className={clsx(
                    "inline-flex items-center gap-1",
                    col.align === "right" && "flex-row-reverse",
                  )}
                >
                  {col.label}
                  {col.sortable &&
                    sortKey === col.key &&
                    (sortDirection === "asc" ? (
                      <ChevronUp size={12} />
                    ) : (
                      <ChevronDown size={12} />
                    ))}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: skeletonRowCount }, (_, i) => (
              <tr key={i} className="h-11 border-b border-border last:border-0">
                {columns.map((col) => (
                  <td key={col.key} className="px-3">
                    <Skeleton className="h-3 w-full max-w-[120px]" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-12">
                {emptyState}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={clsx(
                  "h-11 border-b border-border text-text-primary last:border-0",
                  onRowClick && "cursor-pointer hover:bg-canvas",
                  getRowClassName?.(row),
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={clsx(
                      "px-3",
                      col.align === "right" ? "text-right" : "text-left",
                    )}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
