import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "../components/ui/Button";
import { useDismiss } from "../lib/useDismiss";
import { RANGE_OPTIONS, useDashboardRange } from "./dashboardRange";

export function RangePicker() {
  const [range, setRange] = useDashboardRange();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const close = useCallback(() => setIsOpen(false), []);
  useDismiss(containerRef, isOpen, close);

  const current = RANGE_OPTIONS.find((option) => option.value === range);

  return (
    <div ref={containerRef} className="relative" data-tour="range">
      <Button
        variant="secondary"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Dashboard period: ${current.label}`}
      >
        {current.label}
        <ChevronDown size={14} className="text-text-secondary" />
      </Button>

      {isOpen && (
        <ul
          role="listbox"
          aria-label="Dashboard period"
          className="absolute right-0 top-full z-40 mt-2 min-w-[160px] rounded-card border border-border bg-surface p-1 shadow-pop"
        >
          {RANGE_OPTIONS.map((option) => (
            <li key={option.value} role="option" aria-selected={option.value === range}>
              <button
                type="button"
                onClick={() => {
                  setRange(option.value);
                  close();
                }}
                className={clsx(
                  "flex w-full items-center justify-between gap-3 rounded-btn px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-canvas",
                  option.value === range ? "text-accent" : "text-text-primary"
                )}
              >
                {option.label}
                {option.value === range && <Check size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
