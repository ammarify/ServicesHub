import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatNumber } from "../../lib/formatters";
import { pageItems } from "../../lib/pagination";
import { PAGE_SIZE_OPTIONS } from "../../lib/usePageSize";

function StepButton({ label, disabled, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-btn border border-border bg-surface text-text-secondary transition-colors hover:bg-canvas hover:text-text-primary disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}

// Footer of a list table: which rows are showing out of how many, rows per
// page, and previous / numbered / next page controls.
export function Pagination({ page, pageSize, total, totalPages, onPageChange, onPageSizeChange, label = "results" }) {
  if (!total) return null;

  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label={`${label} pages`}
      className="flex flex-col gap-3 border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-[13px] text-text-secondary" aria-live="polite">
        Showing{" "}
        <span className="font-data font-medium text-text-primary">
          {formatNumber(rangeStart)}–{formatNumber(rangeEnd)}
        </span>{" "}
        of <span className="font-data font-medium text-text-primary">{formatNumber(total)}</span> {label}
      </p>

      <div className="flex items-center justify-between gap-4 sm:justify-end">
        {onPageSizeChange && (
          <label className="flex items-center gap-2 text-[13px] text-text-secondary">
            Rows per page
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="font-data h-8 rounded-btn border border-border bg-surface px-2 text-[13px] text-text-primary"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <StepButton label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              <ChevronLeft size={15} />
            </StepButton>

            <span className="hidden items-center gap-1 sm:flex">
              {pageItems(page, totalPages).map((item) =>
                typeof item === "string" ? (
                  <span key={item} className="font-data w-6 text-center text-text-secondary" aria-hidden="true">
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onPageChange(item)}
                    aria-label={`Page ${item}`}
                    aria-current={item === page ? "page" : undefined}
                    className={clsx(
                      "font-data h-8 min-w-8 rounded-btn px-2 text-[13px] transition-colors",
                      item === page
                        ? "bg-accent font-semibold text-white"
                        : "text-text-secondary hover:bg-canvas hover:text-text-primary"
                    )}
                  >
                    {item}
                  </button>
                )
              )}
            </span>
            <span className="font-data px-2 text-[13px] text-text-secondary sm:hidden">
              {page} / {totalPages}
            </span>

            <StepButton label="Next page" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
              <ChevronRight size={15} />
            </StepButton>
          </div>
        )}
      </div>
    </nav>
  );
}
