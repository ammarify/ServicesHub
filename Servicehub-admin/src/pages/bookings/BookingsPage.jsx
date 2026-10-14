import { PackageSearch } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { QueryError } from "../../components/ui/QueryError";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatDate, formatUSD, formatTime } from "../../lib/formatters";
import { BookingsToolbar } from "./BookingsToolbar";
import { useBookingsList } from "./useBookingsList";

const COLUMNS = [
  {
    key: "code",
    label: "ID",
    render: (booking) => <span className="font-data text-text-secondary">{booking.code}</span>,
  },
  { key: "customerName", label: "Customer", render: (booking) => booking.customer?.name ?? "Unknown" },
  { key: "service", label: "Service" },
  {
    key: "providerName",
    label: "Provider",
    render: (booking) => booking.provider?.name ?? "Unassigned",
  },
  {
    key: "scheduledAt",
    label: "Scheduled",
    sortable: true,
    render: (booking) => (
      <span className="font-data">
        {formatDate(booking.scheduledAt)} {formatTime(booking.scheduledAt)}
      </span>
    ),
  },
  {
    key: "amount",
    label: "Amount",
    align: "right",
    sortable: true,
    render: (booking) => <span className="font-data">{formatUSD(booking.amount)}</span>,
  },
  {
    key: "status",
    label: "Status",
    render: (booking) => <StatusBadge status={booking.status} />,
  },
];

export function BookingsPage() {
  const navigate = useNavigate();
  const list = useBookingsList();

  const rangeStart = list.totalCount === 0 ? 0 : (list.page - 1) * list.pageSize + 1;
  const rangeEnd = Math.min(list.page * list.pageSize, list.totalCount);

  return (
    <div className="flex flex-col gap-4">
      <BookingsToolbar {...list} />

      <Card padded={false}>
        {list.isError ? (
          <QueryError message="Couldn't load bookings." onRetry={list.refetch} />
        ) : (
          <DataTable
            columns={COLUMNS}
            data={list.pageItems}
            getRowKey={(booking) => booking._id}
            onRowClick={(booking) => navigate(`/bookings/${booking._id}`)}
            sortKey={list.sortKey}
            sortDirection={list.sortDirection}
            onSortChange={list.onSortChange}
            isLoading={list.isLoading}
            emptyState={
              <div className="flex flex-col items-center gap-3">
                <PackageSearch size={28} className="text-text-secondary" />
                <p className="text-[13px] text-text-secondary">No bookings match your filters</p>
                <Button variant="ghost" onClick={list.clearFilters}>
                  Clear filters
                </Button>
              </div>
            }
          />
        )}
      </Card>

      {!list.isLoading && !list.isError && list.totalCount > 0 && (
        <div className="flex items-center justify-between text-[13px] text-text-secondary">
          <span className="font-data">
            {rangeStart}–{rangeEnd} of {list.totalCount}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={list.page <= 1}
              onClick={() => list.setPage(list.page - 1)}
            >
              Prev
            </Button>
            <Button
              variant="secondary"
              disabled={list.page >= list.totalPages}
              onClick={() => list.setPage(list.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
