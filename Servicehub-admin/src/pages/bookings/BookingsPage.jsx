import { CircleDashed, PackageSearch, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ServiceLabel } from "../../components/ServiceIcon";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { EmptyState } from "../../components/ui/EmptyState";
import { Pagination } from "../../components/ui/Pagination";
import { QueryError } from "../../components/ui/QueryError";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { formatDate, formatUSD, formatTime } from "../../lib/formatters";
import { can } from "../../lib/permissions";
import { useQueryParamState } from "../../lib/useQueryParamState";
import { BookingFormDialog } from "./BookingFormDialog";
import { BookingsToolbar } from "./BookingsToolbar";
import { useBookingsList } from "./useBookingsList";

const COLUMNS = [
  {
    key: "code",
    label: "ID",
    render: (booking) => <span className="font-data text-text-secondary">{booking.code}</span>,
  },
  {
    key: "customerName",
    label: "Customer",
    render: (booking) => (
      <span className="flex items-center gap-2.5">
        <Avatar name={booking.customer?.name ?? "?"} size={26} />
        <span className="font-medium">{booking.customer?.name ?? "Unknown"}</span>
      </span>
    ),
  },
  { key: "service", label: "Service", render: (booking) => <ServiceLabel service={booking.service} /> },
  {
    key: "providerName",
    label: "Provider",
    render: (booking) =>
      booking.provider ? (
        booking.provider.name
      ) : (
        <span className="inline-flex items-center gap-1.5 text-text-secondary">
          <CircleDashed size={13} />
          Unassigned
        </span>
      ),
  },
  {
    key: "scheduledAt",
    label: "Scheduled",
    sortable: true,
    render: (booking) => (
      <span className="font-data">
        {formatDate(booking.scheduledAt)}
        <span className="text-text-secondary"> {formatTime(booking.scheduledAt)}</span>
      </span>
    ),
  },
  {
    key: "amount",
    label: "Amount",
    align: "right",
    sortable: true,
    render: (booking) => <span className="font-data font-medium">{formatUSD(booking.amount)}</span>,
  },
  {
    key: "status",
    label: "Status",
    render: (booking) => <StatusBadge status={booking.status} />,
  },
];

export function BookingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const list = useBookingsList();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  // ?new=1 opens the form too (the command palette's "New booking").
  const [newParam, setNewParam] = useQueryParamState("new");
  const canCreate = can(user, "booking.create");
  const isFormOpen = isCreateOpen || newParam === "1";

  function closeForm() {
    setIsCreateOpen(false);
    if (newParam) setNewParam(null, { replace: true });
  }

  return (
    <div className="flex flex-col gap-4">
      <BookingsToolbar
        {...list}
        actions={
          canCreate && (
            <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
              <Plus size={14} />
              New booking
            </Button>
          )
        }
      />

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
            isFetching={list.isFetching}
            skeletonRowCount={list.pageSize}
            emptyState={
              list.hasActiveFilters ? (
                <EmptyState
                  icon={PackageSearch}
                  title="No bookings match these filters"
                  description="Try another status or service, or search by a different name or booking ID."
                  action={
                    <Button variant="secondary" onClick={list.clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={PackageSearch}
                  title="No bookings yet"
                  description="Bookings appear here as soon as customers make them."
                  action={
                    canCreate && (
                      <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
                        <Plus size={14} />
                        New booking
                      </Button>
                    )
                  }
                />
              )
            }
            footer={
              <Pagination
                page={list.page}
                pageSize={list.pageSize}
                total={list.totalCount}
                totalPages={list.totalPages}
                onPageChange={list.setPage}
                onPageSizeChange={list.setPageSize}
                label="bookings"
              />
            }
          />
        )}
      </Card>

      {canCreate && (
        <BookingFormDialog
          open={isFormOpen}
          onClose={closeForm}
          onSaved={(booking) => navigate(`/bookings/${booking._id}`)}
        />
      )}
    </div>
  );
}
