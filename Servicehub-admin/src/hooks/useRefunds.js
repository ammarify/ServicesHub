import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useRefunds(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: ["refunds", "list", params],
    queryFn: async () => {
      const { data } = await api.get("/refunds", { params });
      return data;
    },
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useRefund(id) {
  return useQuery({
    queryKey: ["refunds", "detail", id],
    queryFn: async () => {
      const { data } = await api.get(`/refunds/${id}`);
      return data.refund;
    },
    enabled: Boolean(id),
  });
}

function invalidateRefundViews(queryClient) {
  queryClient.invalidateQueries({ queryKey: ["refunds"] });
  // Bookings show their refund summary; the dashboard shows pending totals.
  queryClient.invalidateQueries({ queryKey: ["bookings"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard"] });
}

export function useRequestRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, amount, reason }) => {
      const { data } = await api.post("/refunds", { bookingId, amount, reason });
      return data.refund;
    },
    onSuccess: (refund) => {
      queryClient.setQueryData(["refunds", "detail", refund._id], refund);
      invalidateRefundViews(queryClient);
    },
  });
}

export function useDecideRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision, note }) => {
      const { data } = await api.patch(`/refunds/${id}/decision`, { decision, ...(note ? { note } : {}) });
      return data.refund;
    },
    onSuccess: (refund) => {
      queryClient.setQueryData(["refunds", "detail", refund._id], refund);
      invalidateRefundViews(queryClient);
    },
  });
}
