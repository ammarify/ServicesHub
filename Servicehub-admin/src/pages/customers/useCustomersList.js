import { useMemo, useState } from "react";
import { useCustomers } from "../../hooks/useCustomers";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

const LIST_LIMIT = 50;

export function useCustomersList() {
  const [search, setSearchRaw] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const params = useMemo(() => {
    const p = { limit: LIST_LIMIT };
    if (debouncedSearch.trim()) p.search = debouncedSearch.trim();
    return p;
  }, [debouncedSearch]);

  const query = useCustomers(params);
  const items = query.data?.items ?? [];

  function setSearch(value) {
    setSearchRaw(value);
  }

  function clearFilters() {
    setSearchRaw("");
  }

  return {
    search,
    setSearch,
    items,
    totalCount: query.data?.total ?? 0,
    clearFilters,
    hasActiveFilters: search !== "",
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
