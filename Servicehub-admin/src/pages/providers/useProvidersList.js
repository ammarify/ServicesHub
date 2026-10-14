import { useMemo, useState } from "react";
import { useProviders } from "../../hooks/useProviders";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

export const SERVICE_OPTIONS = [
  "all",
  "AC Repair",
  "Deep Cleaning",
  "Plumbing",
  "Electrical",
  "Maid Service",
  "Pest Control",
];

const LIST_LIMIT = 50;

export function useProvidersList() {
  const [search, setSearchRaw] = useState("");
  const [serviceFilter, setServiceFilterRaw] = useState("all");
  const [availableOnly, setAvailableOnlyRaw] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 300);

  const params = useMemo(() => {
    const p = { limit: LIST_LIMIT };
    if (serviceFilter !== "all") p.service = serviceFilter;
    if (availableOnly) p.availableOnly = "true";
    if (debouncedSearch.trim()) p.search = debouncedSearch.trim();
    return p;
  }, [serviceFilter, availableOnly, debouncedSearch]);

  const query = useProviders(params);
  const items = query.data?.items ?? [];

  function setSearch(value) {
    setSearchRaw(value);
  }

  function setServiceFilter(value) {
    setServiceFilterRaw(value);
  }

  function toggleAvailableOnly() {
    setAvailableOnlyRaw((prev) => !prev);
  }

  function clearFilters() {
    setSearchRaw("");
    setServiceFilterRaw("all");
    setAvailableOnlyRaw(false);
  }

  return {
    search,
    setSearch,
    serviceFilter,
    setServiceFilter,
    availableOnly,
    toggleAvailableOnly,
    items,
    totalCount: query.data?.total ?? 0,
    clearFilters,
    hasActiveFilters: search !== "" || serviceFilter !== "all" || availableOnly,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
