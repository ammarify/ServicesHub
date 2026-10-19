import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useProviders(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: ["providers", params],
    queryFn: async () => {
      const { data } = await api.get("/providers", { params });
      return data;
    },
    placeholderData: keepPreviousData,
    enabled,
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

function useProviderMutation(request) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables) => {
      const { data } = await request(variables);
      return data;
    },
    onSuccess: (detail) => {
      queryClient.setQueryData(["providers", detail.provider._id], detail);
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCreateProvider() {
  return useProviderMutation((body) => api.post("/providers", body));
}

export function useUpdateProvider(id) {
  return useProviderMutation((body) => api.patch(`/providers/${id}`, body));
}

// Only succeeds for a provider with no bookings on record (the API answers
// 409 HAS_HISTORY otherwise, with a message saying what to do instead).
export function useDeleteProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      await api.delete(`/providers/${id}`);
      return id;
    },
    onSuccess: () => {
      // Lists only: the open profile keeps its last data while its drawer
      // slides shut instead of flashing "not found".
      queryClient.invalidateQueries({ queryKey: ["providers"], predicate: (query) => typeof query.queryKey[1] !== "string" });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
