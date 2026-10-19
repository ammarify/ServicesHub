import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import { useSocket } from "../context/SocketContext";
import { formatUSD, humanize } from "../lib/formatters";

// App-wide realtime wiring, mounted once inside the signed-in layout:
// - keeps cached lists fresh when something changes elsewhere (another
//   agent, the customer widget, an approver),
// - turns noteworthy events into bell notifications.
// Conversation-level events (messages, typing for the open ticket) are
// handled by the support page itself (hooks/useTicketSocket.js).
export function RealtimeBridge() {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const location = useLocation();

  // The open conversation, so replies the agent is already reading don't
  // also ping the bell.
  const viewingTicketRef = useRef(null);
  useEffect(() => {
    viewingTicketRef.current =
      location.pathname === "/support" ? new URLSearchParams(location.search).get("ticket") : null;
  }, [location]);

  useEffect(() => {
    if (!socket) return undefined;

    const invalidate = (...keys) => keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));

    function onTicketNew(ticket) {
      invalidate(["tickets"], ["dashboard"]);
      addNotification({
        id: `ticket-new:${ticket._id}`,
        type: "ticket",
        title: `New ticket ${ticket.code}`,
        body: `${ticket.customer?.name ?? "A customer"}: ${ticket.subject}`,
        link: `/support?ticket=${ticket._id}`,
      });
    }

    function onCustomerMessage(payload) {
      invalidate(["tickets", "queue"], ["tickets", "list"]);
      if (viewingTicketRef.current === payload.ticketId) return;
      addNotification({
        id: `ticket-message:${payload.ticketId}:${payload.at}`,
        type: "message",
        title: `${payload.customerName} replied on ${payload.code}`,
        body: payload.text,
        link: `/support?ticket=${payload.ticketId}`,
      });
    }

    function onTicketUpdated(payload) {
      invalidate(["tickets", "queue"], ["tickets", "list"], ["dashboard"]);
      queryClient.setQueryData(["tickets", "detail", payload.ticketId], (old) =>
        old ? { ...old, status: payload.status, priority: payload.priority } : old
      );
    }

    function onRefundRequested(payload) {
      invalidate(["refunds"], ["dashboard"], ["bookings"]);
      addNotification({
        id: `refund-requested:${payload.refundId}`,
        type: "refund",
        title: `Refund ${payload.code} needs a decision`,
        body: `${formatUSD(payload.amount)} on ${payload.bookingCode}, requested by ${payload.requestedByName}`,
        link: `/refunds?refund=${payload.refundId}`,
      });
    }

    function onRefundDecided(payload) {
      invalidate(["refunds"], ["dashboard"], ["bookings"]);
      if (payload.requestedBy !== user?.id) return;
      addNotification({
        id: `refund-decided:${payload.refundId}`,
        type: "refund",
        title: `Refund ${payload.code} ${humanize(payload.status).toLowerCase()}`,
        body: `${formatUSD(payload.amount)} on ${payload.bookingCode}, decided by ${payload.decidedByName}`,
        link: `/refunds?refund=${payload.refundId}`,
      });
    }

    socket.on("ticket:new", onTicketNew);
    socket.on("ticket:customer-message", onCustomerMessage);
    socket.on("ticket:updated", onTicketUpdated);
    socket.on("refund:requested", onRefundRequested);
    socket.on("refund:decided", onRefundDecided);

    return () => {
      socket.off("ticket:new", onTicketNew);
      socket.off("ticket:customer-message", onCustomerMessage);
      socket.off("ticket:updated", onTicketUpdated);
      socket.off("refund:requested", onRefundRequested);
      socket.off("refund:decided", onRefundDecided);
    };
  }, [socket, queryClient, addNotification, user?.id]);

  return null;
}
