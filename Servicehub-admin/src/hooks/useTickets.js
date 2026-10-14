import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

// Shared by the REST mutation below and useTicketSocket.js's live-message
// listener, since both can append the same message to the same ticket
// (a sent message is both the mutation's own response AND a room
// broadcast the sender's own socket also receives) - the dedup check
// keeps that from double-appending.
export function appendMessageToCache(queryClient, ticketId, message) {
  queryClient.setQueryData(["tickets", ticketId], (old) => {
    if (!old) return old;
    const last = old.messages[old.messages.length - 1];
    const isDuplicate = last && last.from === message.from && last.text === message.text && last.at === message.at;
    if (isDuplicate) return old;
    return { ...old, messages: [...old.messages, message] };
  });
}

export function useTickets(params) {
  return useQuery({
    queryKey: ["tickets", params],
    queryFn: async () => {
      const { data } = await api.get("/tickets", { params });
      return data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useTicket(id) {
  return useQuery({
    queryKey: ["tickets", id],
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
      return data.message;
    },
    onSuccess: (message) => {
      appendMessageToCache(queryClient, id, message);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

export function useUpdateTicketStatus(id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (status) => {
      const { data } = await api.patch(`/tickets/${id}/status`, { status });
      return data.ticket;
    },
    onSuccess: (ticket) => {
      queryClient.setQueryData(["tickets", id], ticket);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

export function useUpdateTicketPriority(id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (priority) => {
      const { data } = await api.patch(`/tickets/${id}/priority`, { priority });
      return data.ticket;
    },
    onSuccess: (ticket) => {
      queryClient.setQueryData(["tickets", id], ticket);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

export function useAnalyzeTicket(id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/tickets/${id}/analyze`);
      return data.aiAnalysis;
    },
    onSuccess: (aiAnalysis) => {
      queryClient.setQueryData(["tickets", id], (old) => (old ? { ...old, aiAnalysis } : old));
      // Also refreshes the queue's hasAnalysis flag (list projection) for this ticket's AI dot.
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}
