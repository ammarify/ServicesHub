import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

// Shared by the REST mutation below and the live-message socket listener,
// since both can append the same message to the same ticket (a sent message
// is both the mutation's own response AND a room broadcast the sender's own
// socket also receives) - the dedup check keeps that from double-appending.
export function appendMessageToCache(queryClient, ticketId, message) {
  queryClient.setQueryData(["tickets", "detail", ticketId], (old) => {
    if (!old) return old;
    const isDuplicate = old.messages.some(
      (m) => m.from === message.from && m.text === message.text && m.at === message.at
    );
    if (isDuplicate) return old;
    return { ...old, messages: [...old.messages, message] };
  });
}

const QUEUE_PAGE_SIZE = 30;

// The support queue: pages of tickets for one status, newest activity first,
// with "Load more" fetching the next page.
export function useTicketQueue(status) {
  return useInfiniteQuery({
    queryKey: ["tickets", "queue", status],
    queryFn: async ({ pageParam }) => {
      const { data } = await api.get("/tickets", { params: { status, page: pageParam, limit: QUEUE_PAGE_SIZE } });
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined),
  });
}

export function useTickets(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: ["tickets", "list", params],
    queryFn: async () => {
      const { data } = await api.get("/tickets", { params });
      return data;
    },
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useTicket(id) {
  return useQuery({
    queryKey: ["tickets", "detail", id],
    queryFn: async () => {
      const { data } = await api.get(`/tickets/${id}`);
      return data.ticket;
    },
    enabled: Boolean(id),
  });
}

// Appends the new message straight into the cached ticket so the
// conversation updates instantly, instead of waiting on a refetch.
export function useSendTicketMessage(id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (text) => {
      const { data } = await api.post(`/tickets/${id}/messages`, { text });
      return data;
    },
    onSuccess: ({ message, status }) => {
      appendMessageToCache(queryClient, id, message);
      queryClient.setQueryData(["tickets", "detail", id], (old) => (old ? { ...old, status } : old));
      queryClient.invalidateQueries({ queryKey: ["tickets", "queue"] });
      queryClient.invalidateQueries({ queryKey: ["tickets", "list"] });
    },
  });
}

function useTicketUpdate(id, request) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (value) => {
      const { data } = await request(value);
      return data.ticket;
    },
    onSuccess: (ticket) => {
      // Keep the AI analysis the GET returned if the response omits it.
      queryClient.setQueryData(["tickets", "detail", id], (old) => ({ ...old, ...ticket }));
      queryClient.invalidateQueries({ queryKey: ["tickets", "queue"] });
      queryClient.invalidateQueries({ queryKey: ["tickets", "list"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateTicketStatus(id) {
  return useTicketUpdate(id, (status) => api.patch(`/tickets/${id}/status`, { status }));
}

export function useUpdateTicketPriority(id) {
  return useTicketUpdate(id, (priority) => api.patch(`/tickets/${id}/priority`, { priority }));
}

export function useAnalyzeTicket(id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/tickets/${id}/analyze`);
      return data.aiAnalysis;
    },
    onSuccess: (aiAnalysis) => {
      queryClient.setQueryData(["tickets", "detail", id], (old) => (old ? { ...old, aiAnalysis } : old));
      // Also refreshes the queue's hasAnalysis flag for this ticket's AI icon.
      queryClient.invalidateQueries({ queryKey: ["tickets", "queue"] });
    },
  });
}
