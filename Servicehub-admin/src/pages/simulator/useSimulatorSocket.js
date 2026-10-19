import { useCallback, useEffect, useRef, useState } from "react";
import { createSimulatorSocket } from "../../lib/socket";

const TYPING_TIMEOUT_MS = 2000;
const TYPING_THROTTLE_MS = 1000;

// Page-local (not src/hooks/) since this is the simulator's own socket - a
// separate connection from the staff one, with no cookies. Each ticket is
// unlocked with the per-ticket token the API returned when the ticket was
// opened or resumed.
export function useSimulatorSocket() {
  const [socket] = useState(() => createSimulatorSocket());
  const [typingFrom, setTypingFrom] = useState(null);
  const [connectionError, setConnectionError] = useState("");
  const typingTimeoutRef = useRef(null);
  const currentRef = useRef(null); // { ticketId, token }
  const lastTypingSentRef = useRef(0);

  useEffect(() => {
    // StrictMode mounts effects twice in development; connect() revives the
    // same instance after the first pass's cleanup disconnected it.
    socket.connect();

    function rejoin() {
      setConnectionError("");
      if (currentRef.current) socket.emit("ticket:join", currentRef.current);
    }
    function handleConnectError(err) {
      setConnectionError(
        err?.data?.code === "FEATURE_DISABLED"
          ? "The customer simulator is turned off on this server."
          : "Can't reach the live chat server. Retrying…"
      );
    }
    function handleTyping(payload) {
      if (payload.ticketId !== currentRef.current?.ticketId) return;
      setTypingFrom(payload.from);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTypingFrom(null), TYPING_TIMEOUT_MS);
    }

    // Rooms don't survive a reconnect; re-unlock the open ticket.
    socket.on("connect", rejoin);
    socket.on("connect_error", handleConnectError);
    socket.on("typing", handleTyping);

    return () => {
      socket.off("connect", rejoin);
      socket.off("connect_error", handleConnectError);
      socket.off("typing", handleTyping);
      clearTimeout(typingTimeoutRef.current);
      socket.disconnect();
    };
  }, [socket]);

  function joinTicket(ticketId, token) {
    currentRef.current = { ticketId, token };
    setTypingFrom(null);
    return new Promise((resolve, reject) => {
      socket.emit("ticket:join", { ticketId, token }, (response) => {
        if (response?.ok) resolve();
        else reject(new Error(response?.message || "Couldn't open the live chat."));
      });
    });
  }

  function leaveTicket(ticketId) {
    if (currentRef.current?.ticketId === ticketId) currentRef.current = null;
    socket.emit("ticket:leave", { ticketId });
  }

  const onMessage = useCallback(
    (handler) => {
      socket.on("ticket:message", handler);
      return () => socket.off("ticket:message", handler);
    },
    [socket]
  );

  const onTicketUpdated = useCallback(
    (handler) => {
      socket.on("ticket:updated", handler);
      return () => socket.off("ticket:updated", handler);
    },
    [socket]
  );

  function sendMessage(ticketId, text) {
    return new Promise((resolve, reject) => {
      socket.timeout(10_000).emit("customer:message", { ticketId, text }, (err, response) => {
        if (err) reject(new Error("The message didn't go through. Check your connection and try again."));
        else if (response?.ok) resolve(response.message);
        else reject(new Error(response?.message || "Failed to send message"));
      });
    });
  }

  function emitTyping(ticketId) {
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return;
    lastTypingSentRef.current = now;
    socket.emit("typing", { ticketId });
  }

  return {
    typingFrom,
    connectionError,
    joinTicket,
    leaveTicket,
    onMessage,
    onTicketUpdated,
    sendMessage,
    emitTyping,
  };
}
