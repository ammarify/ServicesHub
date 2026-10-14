import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useBookings(params) {
  return useQuery({
    queryKey: ["bookings", params],
    queryFn: async () => {
      const { data } = await api.get("/bookings", { params });
      return data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useBooking(id) {
  return useQuery({
    queryKey: ["bookings", id],
    queryFn: async () => {
      const { data } = await api.get(`/bookings/${id}`);
      return data.booking;
    },
    enabled: Boolean(id),
  });
}

export function useReassignBooking(id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (providerId) => {
      const { data } = await api.patch(`/bookings/${id}/reassign`, { providerId });
      return data.booking;
    },
    onSuccess: (booking) => {
      // The response already has the new provider + the pushed timeline
      // entry - write it straight into the cache instead of waiting on a
      // refetch, same pattern as useTickets.js's status/priority mutations.
      queryClient.setQueryData(["bookings", id], booking);
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}

export function useCancelBooking(id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.patch(`/bookings/${id}/cancel`);
      return data.booking;
    },
    onSuccess: (booking) => {
      queryClient.setQueryData(["bookings", id], booking);
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}
