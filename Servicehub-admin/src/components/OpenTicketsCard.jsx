import { Link } from "react-router-dom";
import { relativeTime } from "../lib/formatters";
import { Card } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";
import { StatusBadge } from "./ui/StatusBadge";

export function OpenTicketsCard({ tickets, isLoading }) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-semibold text-text-primary">Open tickets</div>
        <Link to="/support" className="text-[13px] text-accent hover:underline">
          View all
        </Link>
      </div>

      <div className="mt-2 flex flex-col">
        {isLoading ? (
          Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border py-2.5 last:border-0">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-40" />
              <Skeleton className="ml-auto h-3 w-14" />
            </div>
          ))
        ) : tickets.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-text-secondary">
            No open tickets — nice work!
          </p>
        ) : (
          tickets.map((ticket) => (
            <Link
              key={ticket._id}
              to="/support"
              className="flex items-center gap-3 border-b border-border py-2.5 text-[13px] last:border-0 hover:bg-canvas"
            >
              <span className="font-data w-16 shrink-0 text-text-secondary">{ticket.code}</span>
              <span className="flex-1 truncate text-text-primary">{ticket.subject}</span>
              <StatusBadge status={ticket.priority} />
              <span className="font-data w-14 shrink-0 text-right text-text-secondary">
                {relativeTime(ticket.createdAt)}
              </span>
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}
