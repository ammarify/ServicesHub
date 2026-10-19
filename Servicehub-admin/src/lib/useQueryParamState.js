import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

// A single URL query parameter as state, e.g. ?customer=<id> for an open
// drawer. Makes records linkable (search results, notifications, other
// pages) and keeps the browser's back button meaningful.
export function useQueryParamState(name) {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(name);

  const setValue = useCallback(
    (next, { replace = false } = {}) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next) params.set(name, next);
          else params.delete(name);
          return params;
        },
        { replace }
      );
    },
    [name, setSearchParams]
  );

  return [value, setValue];
}
