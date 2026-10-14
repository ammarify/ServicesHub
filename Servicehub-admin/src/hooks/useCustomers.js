import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useCustomers(params) {
  return useQuery({
    queryKey: ["customers", params],
    queryFn: async () => {
      const { data } = await api.get("/customers", { params });
      return data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useCustomer(id) {
  return useQuery({
    queryKey: ["customers", id],
    queryFn: async () => {
      const { data } = await api.get(`/customers/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}
