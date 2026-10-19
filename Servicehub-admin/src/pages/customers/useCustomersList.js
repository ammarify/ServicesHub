import { useMemo, useState } from "react";
import { useCustomers } from "../../hooks/useCustomers";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { usePageSize } from "../../lib/usePageSize";

export function useCustomersList() {
  const [search, setSearchRaw] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = usePageSize("customers");
  const debouncedSearch = useDebouncedValue(search, 300);

  const params = useMemo(() => {
    const p = { page, limit: pageSize };
    if (debouncedSearch.trim()) p.search = debouncedSearch.trim();
    return p;
  }, [page, pageSize, debouncedSearch]);

  const query = useCustomers(params);

  function setPageSize(value) {
    setPageSizeRaw(value);
    setPage(1);
  }

  function setSearch(value) {
    setSearchRaw(value);
    setPage(1);
  }

  function clearFilters() {
    setSearchRaw("");
    setPage(1);
  }

  return {
    search,
    setSearch,
    page,
    setPage,
    pageSize,
    setPageSize,
    items: query.data?.items ?? [],
    totalCount: query.data?.total ?? 0,
    totalPages: query.data?.pages ?? 1,
    clearFilters,
    hasActiveFilters: search !== "",
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
}
