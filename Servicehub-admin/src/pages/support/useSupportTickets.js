import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useSendTicketMessage,
  useTicket,
  useTicketQueue,
  useTickets,
  useUpdateTicketPriority,
  useUpdateTicketStatus,
} from "../../hooks/useTickets";
import { useTicketSocket } from "../../hooks/useTicketSocket";
import { useQueryParamState } from "../../lib/useQueryParamState";

export const TABS = ["open", "in_progress", "resolved"];
const PULSE_DURATION_MS = 1000;

export function useSupportTickets({ autoSelectFirst }) {
  const [activeTab, setActiveTab] = useState("open");
  // ?ticket=<id> is the open conversation, so tickets can be linked to from
  // anywhere (search, dashboard, notifications, customer profiles).
  const [selectedTicketId, setSelectedTicketId] = useQueryParamState("ticket");
  const [pulseTicketId, setPulseTicketId] = useState(null);
  const [syncedTabFor, setSyncedTabFor] = useState(null);

  const queueQuery = useTicketQueue(activeTab);
  const tickets = useMemo(() => queueQuery.data?.pages.flatMap((page) => page.items) ?? [], [queueQuery.data]);

  // The header badge always shows the open count, whichever tab is active.
  const openCountQuery = useTickets({ status: "open", limit: 1 });
  const openCount = openCountQuery.data?.total ?? 0;

  // On wide screens, land on the first ticket instead of an empty pane.
  const firstTicketId = tickets[0]?._id;
  useEffect(() => {
    if (autoSelectFirst && !selectedTicketId && firstTicketId) {
      setSelectedTicketId(firstTicketId, { replace: true });
    }
  }, [autoSelectFirst, selectedTicketId, firstTicketId, setSelectedTicketId]);

  const ticketQuery = useTicket(selectedTicketId);
  const selectedTicket = ticketQuery.data ?? null;

  // A ticket opened from a link may live in another tab; switch to it once
  // so it's visible (and highlighted) in the queue.
  if (selectedTicket && syncedTabFor !== selectedTicket._id) {
    setSyncedTabFor(selectedTicket._id);
    if (selectedTicket.status !== activeTab) setActiveTab(selectedTicket.status);
  }

  useEffect(() => {
    if (!pulseTicketId) return undefined;
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

  function selectTicket(id) {
    setSelectedTicketId(id);
  }

  return {
    activeTab,
    setActiveTab,
    tickets,
    openCount,
    selectedTicketId,
    selectedTicket,
    selectTicket,
    pulseTicketId,
    setPulseTicketId,
    typingFrom,
    emitTyping,
    sendMessageMutation,
    updateStatusMutation,
    updatePriorityMutation,
    isQueueLoading: queueQuery.isLoading,
    isQueueError: queueQuery.isError,
    refetchQueue: queueQuery.refetch,
    hasMoreTickets: Boolean(queueQuery.hasNextPage),
    loadMoreTickets: queueQuery.fetchNextPage,
    isLoadingMore: queueQuery.isFetchingNextPage,
    isTicketLoading: ticketQuery.isLoading,
    isTicketError: ticketQuery.isError,
    ticketError: ticketQuery.error,
    refetchTicket: ticketQuery.refetch,
  };
}
