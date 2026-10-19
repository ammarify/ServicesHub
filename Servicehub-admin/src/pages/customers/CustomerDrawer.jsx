import { CalendarDays, History, MapPin, Pencil, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { ServiceIcon } from "../../components/ServiceIcon";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { DangerZone } from "../../components/ui/DangerZone";
import { Drawer } from "../../components/ui/Drawer";
import { InfoList, InfoRow } from "../../components/ui/InfoRow";
import { QueryError } from "../../components/ui/QueryError";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";
import { useCustomer, useDeleteCustomer } from "../../hooks/useCustomers";
import { formatDate, formatNumber, formatUSD, relativeTime } from "../../lib/formatters";

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

export function CustomerDrawer({ customerId, open, onClose, canManage, canOpenTickets, canCreateBooking, onEdit, onNewBooking }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data, isLoading, isError, error, refetch } = useCustomer(customerId);
  const deleteMutation = useDeleteCustomer();

  const customer = data?.customer;
  const customerBookings = data?.bookings ?? [];
  const customerTickets = data?.tickets ?? [];
  const notFound = error?.response?.status === 404;

  async function handleDelete() {
    const { _id: id, name } = customer;
    const deleted = await confirm({
      title: `Delete ${name}?`,
      description: "Their profile is removed for good. This can't be undone.",
      confirmLabel: "Delete customer",
      pendingLabel: "Deleting…",
      tone: "danger",
      onConfirm: () => deleteMutation.mutateAsync(id),
    });
    if (deleted) {
      toast.success(`${name} deleted.`);
      onClose();
    }
  }

  function historyText() {
    const bookings = customer.totalBookings ?? 0;
    const tickets = customer.totalTickets ?? customerTickets.length;
    return [
      bookings > 0 && `${formatNumber(bookings)} booking${bookings === 1 ? "" : "s"}`,
      tickets > 0 && `${formatNumber(tickets)} ticket${tickets === 1 ? "" : "s"}`,
    ]
      .filter(Boolean)
      .join(" and ");
  }

  return (
    <Drawer open={open} onClose={onClose} title="Customer profile">
      {isError ? (
        <QueryError
          message={notFound ? "This customer doesn't exist anymore." : "Couldn't load this customer."}
          onRetry={notFound ? undefined : refetch}
        />
      ) : isLoading || !customer ? (
        <CustomerDrawerSkeleton />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar name={customer.name} size={48} />
              <div>
                <div className="text-[15px] font-semibold text-text-primary">{customer.name}</div>
                <div className="text-[13px] text-text-secondary">{customer.area}</div>
              </div>
            </div>
            {canManage && (
              <Button variant="ghost" onClick={() => onEdit(customer)} aria-label="Edit customer">
                <Pencil size={14} />
                Edit
              </Button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-card border border-border p-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-text-secondary">Bookings</div>
              <div className="font-data mt-0.5 text-[15px] font-semibold text-text-primary">
                {formatNumber(customer.totalBookings)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-text-secondary">Total Spent</div>
              <div className="font-data mt-0.5 text-[15px] font-semibold text-text-primary">
                {formatUSD(customer.totalSpent)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-text-secondary">Tickets</div>
              <div className="font-data mt-0.5 text-[15px] font-semibold text-text-primary">
                {formatNumber(customer.totalTickets ?? customerTickets.length)}
              </div>
            </div>
          </div>

          <InfoList>
            <InfoRow icon={Phone} label="Phone" mono>
              {customer.phone}
            </InfoRow>
            <InfoRow icon={MapPin} label="Area">
              {customer.area}
            </InfoRow>
            <InfoRow icon={CalendarDays} label="Customer since" mono>
              {formatDate(customer.joinedAt)}
            </InfoRow>
            {customer.lastBookingAt && (
              <InfoRow icon={History} label="Last booking" mono>
                {relativeTime(customer.lastBookingAt)}
              </InfoRow>
            )}
          </InfoList>

          {canCreateBooking && (
            <Button variant="secondary" className="w-fit" onClick={() => onNewBooking(customer)}>
              New booking for {customer.name.split(" ")[0]}
            </Button>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-text-primary">Booking history</span>
              {customer.totalBookings > customerBookings.length && (
                <span className="text-[12px] text-text-secondary">
                  Latest <span className="font-data">{customerBookings.length}</span> of{" "}
                  <span className="font-data">{customer.totalBookings}</span>
                </span>
              )}
            </div>
            {customerBookings.length === 0 ? (
              <p className="text-[13px] text-text-secondary">No bookings yet.</p>
            ) : (
              <div className="flex flex-col">
                {customerBookings.map((booking) => (
                  <Link
                    key={booking._id}
                    to={`/bookings/${booking._id}`}
                    className="-mx-2 flex items-center gap-3 rounded-btn px-2 py-2 text-[13px] transition-colors hover:bg-canvas"
                  >
                    <ServiceIcon service={booking.service} size={24} />
                    <span className="font-data w-16 shrink-0 text-text-secondary">{booking.code}</span>
                    <span className="min-w-0 flex-1 truncate text-text-secondary">{booking.service}</span>
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
              <div className="mb-2 text-[13px] font-semibold text-text-primary">Complaint history</div>
              <div className="flex flex-col">
                {customerTickets.map((ticket) => {
                  const row = (
                    <>
                      <span className="font-data w-16 shrink-0 text-text-secondary">{ticket.code}</span>
                      <span className="min-w-0 flex-1 truncate text-text-primary">{ticket.subject}</span>
                      <StatusBadge status={ticket.status} />
                    </>
                  );
                  return canOpenTickets ? (
                    <Link
                      key={ticket._id}
                      to={`/support?ticket=${ticket._id}`}
                      className="flex items-center gap-3 border-b border-border py-2.5 text-[13px] last:border-0 hover:bg-canvas"
                    >
                      {row}
                    </Link>
                  ) : (
                    <div
                      key={ticket._id}
                      className="flex items-center gap-3 border-b border-border py-2.5 text-[13px] last:border-0"
                    >
                      {row}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {canManage && (
            <DangerZone
              title="Delete customer"
              description="Removes this profile for good. Possible only while they have no bookings or tickets."
              disabled={Boolean(historyText())}
              disabledReason={`${customer.name} has ${historyText()} on record, so the profile stays for your records.`}
              actionLabel="Delete customer"
              onAction={handleDelete}
              isPending={deleteMutation.isPending}
            />
          )}
        </div>
      )}
    </Drawer>
  );
}
