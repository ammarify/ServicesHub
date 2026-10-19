import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

// Global search. While a new query loads, the previous results stay on
// screen (the palette dims them) instead of flashing away on every keystroke.
export function useSearch(query) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: async () => {
      const { data } = await api.get("/search", { params: { q: query } });
      return data;
    },
    enabled: query.trim().length > 0,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  });
}
