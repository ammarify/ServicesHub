import { useMemo, useState } from "react";
import { useBookings } from "../../hooks/useBookings";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

const PAGE_SIZE = 12;

export const STATUS_OPTIONS = ["all", "pending", "assigned", "in_progress", "completed", "cancelled"];
export const SERVICE_OPTIONS = [
  "all",
  "AC Repair",
  "Deep Cleaning",
  "Plumbing",
  "Electrical",
  "Maid Service",
  "Pest Control",
];

export function useBookingsList() {
  const [search, setSearchRaw] = useState("");
  const [statusFilter, setStatusFilterRaw] = useState("all");
  const [serviceFilter, setServiceFilterRaw] = useState("all");
  const [sortKey, setSortKey] = useState("scheduledAt");
  const [sortDirection, setSortDirection] = useState("desc");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search, 300);

  const params = useMemo(() => {
    const p = { page, limit: PAGE_SIZE, sortBy: sortKey, sortDir: sortDirection };
    if (statusFilter !== "all") p.status = statusFilter;
    if (serviceFilter !== "all") p.service = serviceFilter;
    if (debouncedSearch.trim()) p.search = debouncedSearch.trim();
    return p;
  }, [page, sortKey, sortDirection, statusFilter, serviceFilter, debouncedSearch]);

  const query = useBookings(params);
  const pageItems = query.data?.items ?? [];
  const totalCount = query.data?.total ?? 0;
  const totalPages = query.data?.pages ?? 1;

  function onSortChange(key) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
    setPage(1);
  }

  function setSearch(value) {
    setSearchRaw(value);
    setPage(1);
  }

  function setStatusFilter(value) {
    setStatusFilterRaw(value);
    setPage(1);
  }

  function setServiceFilter(value) {
    setServiceFilterRaw(value);
    setPage(1);
  }

  function clearFilters() {
    setSearchRaw("");
    setStatusFilterRaw("all");
    setServiceFilterRaw("all");
    setPage(1);
  }

  return {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    serviceFilter,
    setServiceFilter,
    sortKey,
    sortDirection,
    onSortChange,
    page,
    setPage,
    pageSize: PAGE_SIZE,
    totalPages,
    totalCount,
    pageItems,
    clearFilters,
    hasActiveFilters: search !== "" || statusFilter !== "all" || serviceFilter !== "all",
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
