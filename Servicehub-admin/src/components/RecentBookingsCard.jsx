import { Link } from "react-router-dom";
import { formatUSD } from "../lib/formatters";
import { Card } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";
import { StatusBadge } from "./ui/StatusBadge";

export function RecentBookingsCard({ bookings, isLoading }) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-semibold text-text-primary">Recent bookings</div>
        <Link to="/bookings" className="text-[13px] text-accent hover:underline">
          View all
        </Link>
      </div>

      <div className="mt-2 flex flex-col">
        {isLoading ? (
          Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border py-2.5 last:border-0">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="ml-auto h-3 w-16" />
            </div>
          ))
        ) : bookings.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-text-secondary">No bookings yet.</p>
        ) : (
          bookings.map((booking) => (
            <Link
              key={booking._id}
              to={`/bookings/${booking._id}`}
              className="flex items-center gap-3 border-b border-border py-2.5 text-[13px] last:border-0 hover:bg-canvas"
            >
              <span className="font-data w-16 shrink-0 text-text-secondary">{booking.code}</span>
              <span className="min-w-0 flex-[1.2] truncate text-text-primary">
                {booking.customerName}
              </span>
              <span className="min-w-0 flex-1 truncate text-text-secondary">{booking.service}</span>
              <span className="shrink-0">
                <StatusBadge status={booking.status} />
              </span>
              <span className="font-data w-20 shrink-0 text-right text-text-primary">
                {formatUSD(booking.amount)}
              </span>
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}
