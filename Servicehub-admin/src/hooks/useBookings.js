import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useBookings(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: ["bookings", params],
    queryFn: async () => {
      const { data } = await api.get("/bookings", { params });
      return data;
    },
    placeholderData: keepPreviousData,
    enabled,
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

// Every booking mutation answers with the full, populated booking detail,
// written straight into the cache for the detail page. Lists, the dashboard
// and the customer/provider drawers that show bookings are refreshed too.
function useBookingMutation(request) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables) => {
      const { data } = await request(variables);
      return data.booking;
    },
    onSuccess: (booking) => {
      queryClient.setQueryData(["bookings", booking._id], booking);
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      // Tickets embed their booking (status, provider) in the support view.
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

export function useCreateBooking() {
  return useBookingMutation((body) => api.post("/bookings", body));
}

export function useUpdateBooking(id) {
  return useBookingMutation((body) => api.patch(`/bookings/${id}`, body));
}

export function useUpdateBookingStatus(id) {
  return useBookingMutation((status) => api.patch(`/bookings/${id}/status`, { status }));
}

export function useReassignBooking(id) {
  return useBookingMutation((providerId) => api.patch(`/bookings/${id}/reassign`, { providerId }));
}

export function useCancelBooking(id) {
  return useBookingMutation((reason) =>
    api.patch(`/bookings/${id}/cancel`, reason ? { reason } : {})
  );
}
