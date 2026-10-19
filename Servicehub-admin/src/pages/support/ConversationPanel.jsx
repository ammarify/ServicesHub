import clsx from "clsx";
import { ArrowDown, ArrowUpCircle, Menu, Sparkles, WifiOff } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { TypingDots } from "../../components/ui/TypingDots";
import { formatDate, formatTime } from "../../lib/formatters";
import { MessageComposer } from "./MessageComposer";

// Within this distance of the bottom the thread counts as "at the latest
// message" and keeps following new ones.
const STICKY_BOTTOM_PX = 80;

function scrollThreadToEnd(el, behavior = "auto") {
  if (el) el.scrollTo({ top: el.scrollHeight, behavior });
}

function groupMessagesByDay(messages) {
  const days = [];
  for (const message of messages) {
    const dayKey = formatDate(message.at);
    let day = days[days.length - 1];
    if (!day || day.key !== dayKey) {
      day = { key: dayKey, groups: [] };
      days.push(day);
    }
    let group = day.groups[day.groups.length - 1];
    if (!group || group.from !== message.from || group.senderName !== message.senderName) {
      group = { from: message.from, senderName: message.senderName, messages: [] };
      day.groups.push(group);
    }
    group.messages.push(message);
  }
  return days;
}

// Status moves an agent can make from each state.
const STATUS_ACTIONS = {
  open: [
    { status: "in_progress", label: "Start working" },
    { status: "resolved", label: "Mark resolved" },
  ],
  in_progress: [{ status: "resolved", label: "Mark resolved" }],
  resolved: [{ status: "open", label: "Reopen" }],
};

function MessageGroup({ group }) {
  const fromAgent = group.from === "agent";
  const lastAt = group.messages.at(-1).at;

  return (
    <div className={clsx("mb-5 flex gap-2.5", fromAgent ? "flex-row-reverse" : "flex-row")}>
      <Avatar name={group.senderName} size={28} />
      <div className={clsx("flex min-w-0 max-w-[85%] flex-col gap-1 sm:max-w-[70%]", fromAgent ? "items-end" : "items-start")}>
        <span className="px-1 text-[12px] font-medium text-text-primary">{group.senderName}</span>
        {group.messages.map((message, index) => (
          <div
            key={`${message.at}-${index}`}
            className={clsx(
              "whitespace-pre-wrap break-words rounded-card px-3.5 py-2 text-[13px] leading-relaxed",
              fromAgent ? "bg-accent text-white" : "border border-border bg-surface text-text-primary",
              index === 0 && (fromAgent ? "rounded-tr-none" : "rounded-tl-none")
            )}
          >
            {message.text}
          </div>
        ))}
        <span className="font-data px-1 text-[11px] text-text-secondary">{formatTime(lastAt)}</span>
      </div>
    </div>
  );
}

export function ConversationPanel({
  ticket,
  draftText,
  onDraftChange,
  onSend,
  isSending,
  sendError,
  onTyping,
  typingFrom,
  canReply,
  canResolve,
  onChangeStatus,
  onEscalate,
  isUpdating,
  isLive,
  onOpenQueue,
  onOpenCopilot,
}) {
  const threadRef = useRef(null);
  const atBottomRef = useRef(true);
  const messageCount = ticket.messages.length;
  // How many messages had been seen when the agent scrolled away from the
  // bottom; anything newer shows up in the "new messages" button.
  const [scroll, setScroll] = useState({ ticketId: ticket._id, atBottom: true, seenCount: messageCount });
  if (scroll.ticketId !== ticket._id) {
    setScroll({ ticketId: ticket._id, atBottom: true, seenCount: messageCount });
  }

  function scrollToLatest(behavior = "auto") {
    scrollThreadToEnd(threadRef.current, behavior);
  }

  function handleScroll() {
    const el = threadRef.current;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICKY_BOTTOM_PX;
    atBottomRef.current = atBottom;
    setScroll((prev) => {
      const seenCount = atBottom ? messageCount : prev.seenCount;
      return prev.atBottom === atBottom && prev.seenCount === seenCount ? prev : { ...prev, atBottom, seenCount };
    });
  }

  // A newly opened ticket starts at its latest message.
  useLayoutEffect(() => {
    atBottomRef.current = true;
    scrollThreadToEnd(threadRef.current);
  }, [ticket._id]);

  // New messages (and the typing bubble) are followed only while the agent
  // is at the bottom, so reading older history isn't interrupted. The agent's
  // own replies always scroll into view.
  const lastFrom = ticket.messages.at(-1)?.from;
  useLayoutEffect(() => {
    if (atBottomRef.current || lastFrom === "agent") scrollThreadToEnd(threadRef.current);
  }, [messageCount, lastFrom, typingFrom]);

  const days = groupMessagesByDay(ticket.messages);
  const statusActions = canResolve ? STATUS_ACTIONS[ticket.status] ?? [] : [];
  const unseen = scroll.atBottom ? 0 : Math.max(0, messageCount - scroll.seenCount);
  const customerName = ticket.customer?.name ?? "Customer";

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-canvas">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {onOpenQueue && (
            <button
              type="button"
              onClick={onOpenQueue}
              aria-label="Open ticket queue"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-btn text-text-secondary hover:bg-canvas"
            >
              <Menu size={16} />
            </button>
          )}
          <span className="hidden sm:block">
            <Avatar name={customerName} size={36} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-text-primary">{ticket.subject}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-text-secondary">
              <span>{customerName}</span>
              <span className="font-data">{ticket.code}</span>
              {ticket.booking && (
                <Link to={`/bookings/${ticket.booking._id}`} className="font-data text-accent hover:underline">
                  {ticket.booking.code}
                </Link>
              )}
              <StatusBadge status={ticket.status} />
              <StatusBadge status={ticket.priority} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {statusActions.map((action) => (
            <Button key={action.status} variant="secondary" disabled={isUpdating} onClick={() => onChangeStatus(action.status)}>
              {action.label}
            </Button>
          ))}
          {canResolve && ticket.status !== "resolved" && (
            <Button variant="ghost" disabled={ticket.priority === "high" || isUpdating} onClick={onEscalate}>
              <ArrowUpCircle size={14} />
              {ticket.priority === "high" ? "Escalated" : "Escalate"}
            </Button>
          )}
          {onOpenCopilot && (
            <Button variant="ghost" onClick={onOpenCopilot}>
              <Sparkles size={14} />
              Copilot
            </Button>
          )}
        </div>
      </div>

      {isLive === false && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-6 py-1.5 text-[12px] text-warning">
          <WifiOff size={13} />
          Reconnecting… new messages will appear once the connection is back.
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <div
          ref={threadRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto px-4 py-5 sm:px-6"
          aria-label="Conversation"
          role="log"
          aria-live="polite"
        >
          {days.map((day) => (
            <div key={day.key}>
              <div className="my-5 flex items-center gap-3" role="separator" aria-label={day.key}>
                <span className="h-px flex-1 bg-border" />
                <span className="font-data rounded-btn border border-border bg-surface px-2 py-0.5 text-[11px] text-text-secondary">
                  {day.key}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              {day.groups.map((group, index) => (
                <MessageGroup key={index} group={group} />
              ))}
            </div>
          ))}

          {typingFrom === "customer" && (
            <div className="mb-2 flex items-center gap-2.5">
              <Avatar name={customerName} size={28} />
              <div className="rounded-card rounded-tl-none border border-border bg-surface px-3.5 py-3 text-text-secondary">
                <TypingDots />
              </div>
              <span className="sr-only">{customerName} is typing</span>
            </div>
          )}
          {typingFrom === "agent" && (
            <p className="mb-2 flex items-center justify-end gap-2 text-[12px] text-text-secondary">
              <TypingDots className="text-accent" />
              Another agent is typing
            </p>
          )}
        </div>

        {unseen > 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <button
              type="button"
              onClick={() => scrollToLatest("smooth")}
              className="animate-dialog-enter flex items-center gap-1.5 rounded-btn bg-accent px-3 py-1.5 text-[12px] font-medium text-white shadow-pop"
            >
              <ArrowDown size={13} />
              {unseen} new message{unseen === 1 ? "" : "s"}
            </button>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border bg-surface p-4">
        {canReply ? (
          <MessageComposer
            value={draftText}
            onChange={onDraftChange}
            onSend={onSend}
            onTyping={onTyping}
            isSending={isSending}
            error={sendError}
            customerFirstName={customerName.split(" ")[0]}
          />
        ) : (
          <p className="text-[13px] text-text-secondary">Your role can read this conversation but not reply.</p>
        )}
      </div>
    </div>
  );
}
