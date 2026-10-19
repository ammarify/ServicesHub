import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "../context/SocketContext";
import { appendMessageToCache } from "./useTickets";

const TYPING_TIMEOUT_MS = 2000;
const TYPING_THROTTLE_MS = 1000;

// Live conversation plumbing for the Support Center: follows the selected
// ticket's room (re-joining after reconnects, since rooms don't survive a
// dropped connection), appends live messages into the query cache, tracks
// the other side's typing indicator, and reports new tickets for the queue's
// highlight. App-wide effects of the same events (bell, list refreshes) live
// in layouts/RealtimeBridge.jsx.
export function useTicketSocket({ ticketId, onNewTicket } = {}) {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [typing, setTyping] = useState({ ticketId: null, from: null });
  const typingTimeoutRef = useRef(null);
  const lastTypingSentRef = useRef(0);

  useEffect(() => {
    if (!socket || !ticketId) return undefined;

    const join = () => socket.emit("ticket:join", ticketId);
    join();
    socket.on("connect", join);

    function handleMessage(payload) {
      if (payload.ticketId !== ticketId) return;
      appendMessageToCache(queryClient, ticketId, payload.message);
      if (payload.message.from === "customer") {
        setTyping({ ticketId: null, from: null });
      }
    }

    function handleTyping(payload) {
      if (payload.ticketId !== ticketId) return;
      setTyping({ ticketId, from: payload.from });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTyping({ ticketId: null, from: null }), TYPING_TIMEOUT_MS);
    }

    socket.on("ticket:message", handleMessage);
    socket.on("typing", handleTyping);

    return () => {
      socket.off("connect", join);
      socket.off("ticket:message", handleMessage);
      socket.off("typing", handleTyping);
      clearTimeout(typingTimeoutRef.current);
      socket.emit("ticket:leave", ticketId);
    };
  }, [socket, ticketId, queryClient]);

  useEffect(() => {
    if (!socket || !onNewTicket) return undefined;
    socket.on("ticket:new", onNewTicket);
    return () => socket.off("ticket:new", onNewTicket);
  }, [socket, onNewTicket]);

  function emitTyping() {
    if (!socket || !ticketId) return;
    const now = Date.now();
    // At most one event a second while the agent keeps typing.
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return;
    lastTypingSentRef.current = now;
    socket.emit("typing", { ticketId });
  }

  return {
    typingFrom: typing.ticketId === ticketId ? typing.from : null,
    emitTyping,
  };
}
