import { useBookings } from "./useBookings";
import { useCustomers } from "./useCustomers";

const PICKER_LIMIT = 8;

// Option sources for <SearchSelect>.
export function useCustomerOptions(query) {
  const result = useCustomers({ limit: PICKER_LIMIT, ...(query ? { search: query } : {}) });
  return { items: result.data?.items ?? [], isLoading: result.isFetching };
}

export function useBookingOptions(query) {
  const result = useBookings({
    limit: PICKER_LIMIT,
    sortBy: "scheduledAt",
    sortDir: "desc",
    ...(query ? { search: query } : {}),
  });
  return { items: result.data?.items ?? [], isLoading: result.isFetching };
}
