import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useSearch(query) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: async () => {
      const { data } = await api.get("/search", { params: { q: query } });
      return data;
    },
    enabled: query.trim().length > 0,
    staleTime: 10_000,
  });
}
