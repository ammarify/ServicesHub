import { useCallback, useEffect, useState } from "react";
import {
  useSendTicketMessage,
  useTicket,
  useTickets,
  useUpdateTicketPriority,
  useUpdateTicketStatus,
} from "../../hooks/useTickets";
import { useTicketSocket } from "../../hooks/useTicketSocket";

export const TABS = ["open", "in_progress", "resolved"];
const PULSE_DURATION_MS = 1000;
const LIST_LIMIT = 50;

export function useSupportTickets() {
  const [activeTab, setActiveTab] = useState("open");
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [pulseTicketId, setPulseTicketId] = useState(null);

  const listQuery = useTickets({ status: activeTab, limit: LIST_LIMIT });
  const filteredTickets = listQuery.data?.items ?? [];

  // The queue header always shows the open count, regardless of which tab
  // is active - separate from (but often cached-identical to) the list query.
  const openCountQuery = useTickets({ status: "open", limit: LIST_LIMIT });
  const openCount = openCountQuery.data?.total ?? 0;

  useEffect(() => {
    if (selectedTicketId || filteredTickets.length === 0) return;
    setSelectedTicketId(filteredTickets[0]._id);
  }, [selectedTicketId, filteredTickets]);

  const ticketQuery = useTicket(selectedTicketId);
  const selectedTicket = ticketQuery.data ?? null;

  useEffect(() => {
    if (!pulseTicketId) return;
    const timer = setTimeout(() => setPulseTicketId(null), PULSE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [pulseTicketId]);

  const handleNewTicket = useCallback((ticket) => setPulseTicketId(ticket._id), []);
  const { typingFrom, emitTyping } = useTicketSocket({
    ticketId: selectedTicketId,
    onNewTicket: handleNewTicket,
  });

  const sendMessageMutation = useSendTicketMessage(selectedTicketId);
  const updateStatusMutation = useUpdateTicketStatus(selectedTicketId);
  const updatePriorityMutation = useUpdateTicketPriority(selectedTicketId);

  function markResolved(id) {
    updateStatusMutation.mutate("resolved");
    setPulseTicketId(id);
  }

  function escalate(id) {
    updatePriorityMutation.mutate("high");
    setPulseTicketId(id);
  }

  function sendMessage(id, text) {
    sendMessageMutation.mutate(text);
    setPulseTicketId(id);
  }

  return {
    activeTab,
    setActiveTab,
    filteredTickets,
    openCount,
    selectedTicketId,
    selectedTicket,
    selectTicket: setSelectedTicketId,
    markResolved,
    escalate,
    sendMessage,
    pulseTicketId,
    typingFrom,
    emitTyping,
    isQueueLoading: listQuery.isLoading,
    isQueueError: listQuery.isError,
    refetchQueue: listQuery.refetch,
    isTicketLoading: ticketQuery.isLoading,
    isTicketError: ticketQuery.isError,
    refetchTicket: ticketQuery.refetch,
  };
}
