import { useEffect, useRef, useState } from "react";
import { createSimulatorSocket } from "../../lib/socket";

const TYPING_TIMEOUT_MS = 2000;

// Page-local (not src/hooks/) since this is the simulator's own throwaway
// socket - a separate connection from the staff singleton in lib/socket.js,
// authenticated only via handshake auth ({ role: "simulator" }), never
// cookies.
export function useSimulatorSocket() {
  const [socket] = useState(() => createSimulatorSocket());
  const [typingFrom, setTypingFrom] = useState(null);
  const typingTimeoutRef = useRef(null);
  const currentTicketRef = useRef(null);

  useEffect(() => {
    // StrictMode double-invokes effects in dev: mount -> cleanup -> mount
    // again. socket.io-client doesn't auto-reconnect a socket that was
    // explicitly disconnected, so without this the second mount would be
    // silently dead - connect() re-establishes it if the first pass's
    // cleanup already tore it down.
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, [socket]);

  useEffect(() => {
    function handleTyping(payload) {
      if (payload.ticketId !== currentTicketRef.current) return;
      setTypingFrom(payload.from);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTypingFrom(null), TYPING_TIMEOUT_MS);
    }

    socket.on("typing", handleTyping);
    return () => {
      socket.off("typing", handleTyping);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [socket]);

  function joinTicket(ticketId) {
    currentTicketRef.current = ticketId;
    setTypingFrom(null);
    socket.emit("ticket:join", ticketId);
  }

  function leaveTicket(ticketId) {
    if (currentTicketRef.current === ticketId) currentTicketRef.current = null;
    socket.emit("ticket:leave", ticketId);
  }

  function onMessage(handler) {
    socket.on("ticket:message", handler);
    return () => socket.off("ticket:message", handler);
  }

  function sendMessage(ticketId, text) {
    return new Promise((resolve, reject) => {
      socket.emit("customer:message", { ticketId, text }, (response) => {
        if (response?.ok) resolve(response.message);
        else reject(new Error(response?.message || "Failed to send message"));
      });
    });
  }

  function emitTyping(ticketId) {
    socket.emit("typing", { ticketId, from: "customer" });
  }

  return { typingFrom, joinTicket, leaveTicket, onMessage, sendMessage, emitTyping };
}
