import clsx from "clsx";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Skeleton } from "./Skeleton";

const SKELETON_WIDTHS = ["w-16", "w-28", "w-20", "w-32", "w-14", "w-24"];

function cellAlign(col) {
  return col.align === "right" ? "text-right" : "text-left";
}

// Clickable rows are also reachable with the keyboard: Tab to a row, Enter
// (or Space) opens it, the same as a click.
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
  isFetching,
  emptyState,
  skeletonRowCount = 8,
  footer,
}) {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border bg-canvas/60">
              {columns.map((col) => {
                const isSorted = col.sortable && sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={
                      isSorted ? (sortDirection === "asc" ? "ascending" : "descending") : col.sortable ? "none" : undefined
                    }
                    className={clsx(
                      "h-10 whitespace-nowrap px-4 text-[11px] font-semibold uppercase tracking-wide text-text-secondary first:pl-5 last:pr-5",
                      cellAlign(col)
                    )}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => onSortChange(col.key)}
                        className={clsx(
                          "inline-flex items-center gap-1 rounded-btn align-middle uppercase leading-none tracking-wide transition-colors hover:text-text-primary",
                          isSorted && "text-text-primary",
                          col.align === "right" && "flex-row-reverse"
                        )}
                      >
                        {col.label}
                        {isSorted ? (
                          sortDirection === "asc" ? (
                            <ArrowUp size={12} />
                          ) : (
                            <ArrowDown size={12} />
                          )
                        ) : (
                          <ChevronsUpDown size={12} className="opacity-50" />
                        )}
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className={clsx("transition-opacity duration-150", isFetching && !isLoading && "opacity-60")}>
            {isLoading ? (
              Array.from({ length: skeletonRowCount }, (_, rowIndex) => (
                <tr key={rowIndex} className="h-12 border-b border-border last:border-0">
                  {columns.map((col, colIndex) => (
                    <td key={col.key} className={clsx("px-4 first:pl-5 last:pr-5", cellAlign(col))}>
                      <Skeleton
                        className={clsx(
                          "inline-block h-3",
                          SKELETON_WIDTHS[(rowIndex + colIndex) % SKELETON_WIDTHS.length]
                        )}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-14">
                  {emptyState}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={getRowKey(row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.target !== event.currentTarget) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  className={clsx(
                    "h-12 border-b border-border text-text-primary transition-colors last:border-0",
                    onRowClick &&
                      "cursor-pointer hover:bg-canvas/70 focus-visible:bg-accent/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                    getRowClassName?.(row)
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={clsx(
                        // Rows stay one line; narrow screens scroll the
                        // table sideways instead of wrapping "BK-" / "4801".
                        "whitespace-nowrap px-4 first:pl-5 last:pr-5",
                        cellAlign(col)
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
      {footer}
    </div>
  );
}
