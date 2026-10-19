import { useCallback, useState } from "react";

export const PAGE_SIZE_OPTIONS = [10, 25, 50];
const DEFAULT_PAGE_SIZE = 10;

function storageKey(list) {
  return `servihub-page-size:${list}`;
}

function readStored(list) {
  try {
    const value = Number(localStorage.getItem(storageKey(list)));
    return PAGE_SIZE_OPTIONS.includes(value) ? value : DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

// Rows per page for one list, remembered in this browser so a manager who
// prefers 50 rows doesn't pick it again on every visit.
export function usePageSize(list) {
  const [pageSize, setPageSizeState] = useState(() => readStored(list));

  const setPageSize = useCallback(
    (value) => {
      if (!PAGE_SIZE_OPTIONS.includes(value)) return;
      setPageSizeState(value);
      try {
        localStorage.setItem(storageKey(list), String(value));
      } catch {
        // Storage can be unavailable (private mode); the choice still applies now.
      }
    },
    [list]
  );

  return [pageSize, setPageSize];
}
