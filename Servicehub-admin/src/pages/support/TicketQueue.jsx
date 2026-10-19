import clsx from "clsx";
import { Inbox, Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { QueryError } from "../../components/ui/QueryError";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { relativeTime } from "../../lib/formatters";
import { TABS } from "./useSupportTickets";

const TAB_LABELS = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

const EMPTY_TEXT = {
  open: "No open tickets. New ones appear here the moment a customer writes in.",
  in_progress: "Nothing in progress right now.",
  resolved: "No resolved tickets yet.",
};

function QueueSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex gap-3 border-b border-border px-4 py-3.5">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-44" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
      ))}
    </div>
  );
}

function matches(ticket, query) {
  const haystack = `${ticket.subject} ${ticket.customer?.name ?? ""} ${ticket.code}`.toLowerCase();
  return haystack.includes(query);
}

function TicketItem({ ticket, isSelected, isPulsing, onSelect }) {
  const preview = ticket.lastMessage?.text;
  const fromAgent = ticket.lastMessage?.from === "agent";

  return (
    <button
      type="button"
      onClick={() => onSelect(ticket._id)}
      aria-current={isSelected ? "true" : undefined}
      className={clsx(
        "relative flex w-full gap-3 border-b border-border px-4 py-3.5 text-left transition-colors",
        isSelected ? "bg-accent/5" : "hover:bg-canvas",
        isPulsing && "animate-highlight-pulse"
      )}
    >
      {isSelected && <span className="absolute inset-y-0 left-0 w-0.5 bg-accent" aria-hidden="true" />}
      <span className="relative">
        <Avatar name={ticket.customer?.name ?? "?"} size={32} />
        {ticket.unanswered && (
          <span
            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent"
            aria-hidden="true"
          />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={clsx("truncate text-[13px] text-text-primary", ticket.unanswered ? "font-semibold" : "font-medium")}>
            {ticket.customer?.name ?? "Unknown customer"}
          </span>
          <span className="font-data shrink-0 text-[11px] text-text-secondary">{relativeTime(ticket.updatedAt)}</span>
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-text-primary">{ticket.subject}</span>
        {preview && (
          <span className="mt-0.5 block truncate text-[12px] text-text-secondary">
            {fromAgent && <span className="text-text-primary">Agent: </span>}
            {preview}
          </span>
        )}
        <span className="mt-2 flex items-center gap-2">
          <StatusBadge status={ticket.priority} />
          <span className="font-data text-[11px] text-text-secondary">{ticket.code}</span>
          {ticket.hasAnalysis && (
            <span className="inline-flex items-center gap-1 text-[11px] text-accent">
              <Sparkles size={11} aria-hidden="true" />
              Analyzed
            </span>
          )}
          {ticket.unanswered && <span className="sr-only">Waiting for a reply</span>}
        </span>
      </span>
    </button>
  );
}

export function TicketQueue({
  tickets,
  openCount,
  activeTab,
  onTabChange,
  selectedTicketId,
  onSelectTicket,
  pulseTicketId,
  isLoading,
  isError,
  onRetry,
  hasMore,
  onLoadMore,
  isLoadingMore,
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const visible = normalized ? tickets.filter((ticket) => matches(ticket, normalized)) : tickets;

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="shrink-0 border-b border-border px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-text-primary">Inbox</h2>
          <span className="text-[12px] text-text-secondary">
            <span className="font-data font-semibold text-accent">{openCount}</span> open
          </span>
        </div>

        <div className="relative mt-3">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by customer, subject or ID"
            aria-label="Filter tickets"
            className="pl-8"
          />
        </div>

        <div className="mt-3 grid grid-cols-3 rounded-btn border border-border bg-canvas p-0.5" role="tablist" aria-label="Ticket status">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => onTabChange(tab)}
              className={clsx(
                "rounded-btn px-2 py-1 text-[12px] transition-colors",
                activeTab === tab ? "bg-surface font-medium text-text-primary shadow-card" : "text-text-secondary hover:text-text-primary"
              )}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isError ? (
          <QueryError message="Couldn't load tickets." onRetry={onRetry} />
        ) : isLoading ? (
          <QueueSkeleton />
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <Inbox size={22} className="text-text-secondary" aria-hidden="true" />
            <p className="text-[13px] text-text-secondary">
              {normalized ? "No tickets match that filter." : EMPTY_TEXT[activeTab]}
            </p>
          </div>
        ) : (
          <>
            {visible.map((ticket) => (
              <TicketItem
                key={ticket._id}
                ticket={ticket}
                isSelected={selectedTicketId === ticket._id}
                isPulsing={pulseTicketId === ticket._id}
                onSelect={onSelectTicket}
              />
            ))}
            {hasMore && (
              <div className="p-3">
                <Button variant="ghost" className="w-full justify-center" onClick={onLoadMore} disabled={isLoadingMore}>
                  {isLoadingMore ? "Loading…" : "Load more"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
