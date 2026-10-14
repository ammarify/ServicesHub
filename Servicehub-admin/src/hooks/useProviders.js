import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useProviders(params) {
  return useQuery({
    queryKey: ["providers", params],
    queryFn: async () => {
      const { data } = await api.get("/providers", { params });
      return data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useProvider(id) {
  return useQuery({
    queryKey: ["providers", id],
    queryFn: async () => {
      const { data } = await api.get(`/providers/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}
