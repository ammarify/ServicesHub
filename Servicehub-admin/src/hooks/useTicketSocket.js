import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNotifications } from "../context/NotificationContext";
import { getSocket } from "../lib/socket";
import { appendMessageToCache } from "./useTickets";

const TYPING_TIMEOUT_MS = 2000;

// Handles everything the Support Center needs from the socket: joining/
// leaving the room for whichever ticket is selected, appending live
// messages into the TanStack Query cache, a 2s-decaying typing indicator,
// and the global "a new ticket came in" signal (queue pulse + topbar dot).
export function useTicketSocket({ ticketId, onNewTicket } = {}) {
  const queryClient = useQueryClient();
  const { incrementNewTicket } = useNotifications();
  const [typingFrom, setTypingFrom] = useState(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !ticketId) return undefined;

    socket.emit("ticket:join", ticketId);
    return () => {
      socket.emit("ticket:leave", ticketId);
    };
  }, [ticketId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !ticketId) return undefined;

    function handleMessage(payload) {
      if (payload.ticketId !== ticketId) return;
      appendMessageToCache(queryClient, ticketId, payload.message);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    }

    function handleTyping(payload) {
      if (payload.ticketId !== ticketId) return;
      setTypingFrom(payload.from);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTypingFrom(null), TYPING_TIMEOUT_MS);
    }

    socket.on("ticket:message", handleMessage);
    socket.on("typing", handleTyping);

    return () => {
      socket.off("ticket:message", handleMessage);
      socket.off("typing", handleTyping);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setTypingFrom(null);
    };
  }, [ticketId, queryClient]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    function handleNewTicket(ticket) {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      incrementNewTicket();
      onNewTicket?.(ticket);
    }

    socket.on("ticket:new", handleNewTicket);
    return () => socket.off("ticket:new", handleNewTicket);
  }, [queryClient, incrementNewTicket, onNewTicket]);

  function emitTyping() {
    const socket = getSocket();
    if (socket && ticketId) socket.emit("typing", { ticketId, from: "agent" });
  }

  return { typingFrom, emitTyping };
}
