import { Link } from "react-router-dom";
import { Avatar } from "../../components/ui/Avatar";
import { DetailField } from "../../components/ui/DetailField";
import { Drawer } from "../../components/ui/Drawer";
import { QueryError } from "../../components/ui/QueryError";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useCustomer } from "../../hooks/useCustomers";
import { formatDate, formatNumber, formatUSD } from "../../lib/formatters";

function CustomerDrawerSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export function CustomerDrawer({ customerId, open, onClose }) {
  const { data, isLoading, isError, refetch } = useCustomer(customerId);

  const customer = data?.customer;
  const customerBookings = data?.bookings ?? [];
  const customerTickets = data?.tickets ?? [];

  return (
    <Drawer open={open} onClose={onClose} title="Customer profile">
      {isError ? (
        <QueryError message="Couldn't load this customer." onRetry={refetch} />
      ) : isLoading || !customer ? (
        <CustomerDrawerSkeleton />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Avatar name={customer.name} size={48} />
            <div>
              <div className="text-[15px] font-semibold text-text-primary">{customer.name}</div>
              <div className="text-[13px] text-text-secondary">{customer.area}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-card border border-border p-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-text-secondary">Bookings</div>
              <div className="font-data mt-0.5 text-[15px] font-semibold text-text-primary">
                {formatNumber(customer.totalBookings)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-text-secondary">
                Total Spent
              </div>
              <div className="font-data mt-0.5 text-[15px] font-semibold text-text-primary">
                {formatUSD(customer.totalSpent)}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <DetailField label="Phone" mono>
              {customer.phone}
            </DetailField>
            <DetailField label="Area">{customer.area}</DetailField>
            <DetailField label="Joined" mono>
              {formatDate(customer.joinedAt)}
            </DetailField>
          </div>

          <div>
            <div className="mb-2 text-[13px] font-semibold text-text-primary">Booking history</div>
            {customerBookings.length === 0 ? (
              <p className="text-[13px] text-text-secondary">No bookings yet.</p>
            ) : (
              <div className="flex flex-col">
                {customerBookings.map((booking) => (
                  <Link
                    key={booking._id}
                    to={`/bookings/${booking._id}`}
                    className="flex items-center gap-3 border-b border-border py-2.5 text-[13px] last:border-0 hover:bg-canvas"
                  >
                    <span className="font-data w-16 shrink-0 text-text-secondary">{booking.code}</span>
                    <span className="min-w-0 flex-1 truncate text-text-secondary">
                      {booking.service}
                    </span>
                    <StatusBadge status={booking.status} />
                    <span className="font-data w-20 shrink-0 text-right text-text-primary">
                      {formatUSD(booking.amount)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {customerTickets.length > 0 && (
            <div>
              <div className="mb-2 text-[13px] font-semibold text-text-primary">
                Complaint history
              </div>
              <div className="flex flex-col">
                {customerTickets.map((ticket) => (
                  <Link
                    key={ticket._id}
                    to="/support"
                    className="flex items-center gap-3 border-b border-border py-2.5 text-[13px] last:border-0 hover:bg-canvas"
                  >
                    <span className="font-data w-16 shrink-0 text-text-secondary">{ticket.code}</span>
                    <span className="min-w-0 flex-1 truncate text-text-primary">
                      {ticket.subject}
                    </span>
                    <StatusBadge status={ticket.status} />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
