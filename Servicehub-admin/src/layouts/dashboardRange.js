import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

export const RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

const DEFAULT_RANGE = "week";

// The dashboard's period lives in the URL (?range=month) so it survives a
// refresh and can be shared.
export function useDashboardRange() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("range");
  const range = RANGE_OPTIONS.some((option) => option.value === requested) ? requested : DEFAULT_RANGE;

  const setRange = useCallback(
    (value) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === DEFAULT_RANGE) next.delete("range");
          else next.set("range", value);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return [range, setRange];
}
