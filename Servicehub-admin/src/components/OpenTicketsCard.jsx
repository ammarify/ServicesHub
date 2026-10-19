import { relativeTime } from "../lib/formatters";
import { ListCard, ListRow } from "./dashboard/ListCard";
import { Avatar } from "./ui/Avatar";
import { StatusBadge } from "./ui/StatusBadge";

export function OpenTicketsCard({ tickets, isLoading }) {
  return (
    <ListCard
      title="Open tickets"
      subtitle="Waiting for an agent"
      viewAllTo="/support"
      viewAllLabel="Open support"
      isLoading={isLoading}
      isEmpty={tickets.length === 0}
      emptyText="No open tickets. New ones appear here as customers write in."
    >
      {tickets.map((ticket) => (
        <ListRow
          key={ticket._id}
          to={`/support?ticket=${ticket._id}`}
          leading={<Avatar name={ticket.customer?.name ?? "?"} size={32} />}
          title={ticket.subject}
          meta={
            <>
              <span className="font-data">{ticket.code}</span> · {ticket.customer?.name ?? "Unknown customer"}
            </>
          }
          trailing={
            <>
              <StatusBadge status={ticket.priority} />
              <span className="font-data w-14 text-right text-[12px] text-text-secondary">{relativeTime(ticket.createdAt)}</span>
            </>
          }
        />
      ))}
    </ListCard>
  );
}
