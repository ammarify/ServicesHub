import clsx from "clsx";
import { Menu, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatDate, formatTime } from "../../lib/formatters";
import { MessageComposer } from "./MessageComposer";

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
    if (!group || group.from !== message.from) {
      group = { from: message.from, senderName: message.senderName, at: message.at, texts: [] };
      day.groups.push(group);
    }
    group.texts.push(message.text);
  }
  return days;
}

export function ConversationPanel({
  ticket,
  draftText,
  onDraftChange,
  onSend,
  onTyping,
  typingFrom,
  onMarkResolved,
  onEscalate,
  onOpenQueue,
  onOpenCopilot,
}) {
  const threadRef = useRef(null);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [ticket._id, ticket.messages.length]);

  const days = groupMessagesByDay(ticket.messages);

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-canvas">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border bg-surface px-6 py-4">
        <div className="flex items-start gap-3">
          {onOpenQueue && (
            <button
              type="button"
              onClick={onOpenQueue}
              aria-label="Open ticket queue"
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-btn text-text-secondary hover:bg-canvas"
            >
              <Menu size={16} />
            </button>
          )}
          <div>
            <h2 className="text-[15px] font-semibold text-text-primary">{ticket.subject}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-text-secondary">
              <span className="font-data">{ticket.code}</span>
              <span>·</span>
              <Link
                to={`/bookings/${ticket.booking._id}`}
                className="font-data text-accent hover:underline"
              >
                {ticket.booking.code}
              </Link>
              <StatusBadge status={ticket.status} />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            disabled={ticket.status === "resolved"}
            onClick={onMarkResolved}
          >
            Mark resolved
          </Button>
          <Button variant="ghost" disabled={ticket.priority === "high"} onClick={onEscalate}>
            Escalate
          </Button>
          {onOpenCopilot && (
            <Button variant="ghost" onClick={onOpenCopilot}>
              <Sparkles size={14} />
              Copilot
            </Button>
          )}
        </div>
      </div>

      {typingFrom && (
        <div className="shrink-0 border-b border-border bg-surface px-6 py-1.5">
          <span className="font-data text-[11px] text-text-secondary">
            {typingFrom === "customer" ? "Customer" : "Agent"} is typing…
          </span>
        </div>
      )}

      <div ref={threadRef} className="flex-1 overflow-y-auto px-6 py-4">
        {days.map((day) => (
          <div key={day.key}>
            <div className="font-data my-4 text-center text-[11px] uppercase tracking-wide text-text-secondary">
              {day.key}
            </div>
            {day.groups.map((group, index) => (
              <div
                key={index}
                className={clsx(
                  "mb-4 flex flex-col gap-1",
                  group.from === "agent" ? "items-end" : "items-start",
                )}
              >
                <div className="flex items-center gap-2 px-1 text-[12px]">
                  <span className="font-medium text-text-primary">{group.senderName}</span>
                  <span className="font-data text-text-secondary">{formatTime(group.at)}</span>
                </div>
                {group.texts.map((text, textIndex) => (
                  <div
                    key={textIndex}
                    className={clsx(
                      "max-w-[70%] rounded-card px-3 py-2 text-[13px] leading-relaxed text-text-primary",
                      group.from === "agent" ? "bg-accent/10" : "border border-border bg-surface",
                    )}
                  >
                    {text}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-border bg-surface p-4">
        <MessageComposer value={draftText} onChange={onDraftChange} onSend={onSend} onTyping={onTyping} />
      </div>
    </div>
  );
}
