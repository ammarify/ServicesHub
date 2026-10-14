import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

// The refunds screen has no pagination UI (tabs only), so the list
// always requests the max page size rather than exposing page/limit
// controls that don't exist in this view.
const REFUNDS_LIMIT = 50;

export function useRefunds(status) {
  return useQuery({
    queryKey: ["refunds", status],
    queryFn: async () => {
      const { data } = await api.get("/refunds", { params: { status, limit: REFUNDS_LIMIT } });
      return data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useRefund(id) {
  return useQuery({
    queryKey: ["refunds", id],
    queryFn: async () => {
      const { data } = await api.get(`/refunds/${id}`);
      return data.refund;
    },
    enabled: Boolean(id),
  });
}

export function useRequestRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, amount, reason }) => {
      const { data } = await api.post("/refunds", { bookingId, amount, reason });
      return data.refund;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["refunds"] });
    },
  });
}

export function useDecideRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision }) => {
      const { data } = await api.patch(`/refunds/${id}/decision`, { decision });
      return data.refund;
    },
    onSuccess: (refund) => {
      queryClient.setQueryData(["refunds", refund._id], refund);
      queryClient.invalidateQueries({ queryKey: ["refunds"] });
    },
  });
}
