import { formatUSD, relativeTime } from "../lib/formatters";
import { ListCard, ListRow } from "./dashboard/ListCard";
import { ServiceIcon } from "./ServiceIcon";
import { StatusBadge } from "./ui/StatusBadge";

export function RecentBookingsCard({ bookings, isLoading }) {
  return (
    <ListCard
      title="Recent bookings"
      subtitle="Newest first"
      viewAllTo="/bookings"
      isLoading={isLoading}
      isEmpty={bookings.length === 0}
      emptyText="No bookings yet."
    >
      {bookings.map((booking) => (
        <ListRow
          key={booking._id}
          to={`/bookings/${booking._id}`}
          leading={<ServiceIcon service={booking.service} size={32} />}
          title={booking.customerName}
          meta={
            <>
              <span className="font-data">{booking.code}</span> · {booking.service} ·{" "}
              <span className="font-data">{relativeTime(booking.createdAt)}</span>
            </>
          }
          trailing={
            <>
              <span className="hidden sm:inline">
                <StatusBadge status={booking.status} />
              </span>
              <span className="font-data w-14 text-right font-medium text-text-primary">{formatUSD(booking.amount)}</span>
            </>
          }
        />
      ))}
    </ListCard>
  );
}
