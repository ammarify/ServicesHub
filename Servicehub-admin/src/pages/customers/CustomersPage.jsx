import { Plus, UserRoundSearch } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { EmptyState } from "../../components/ui/EmptyState";
import { Pagination } from "../../components/ui/Pagination";
import { QueryError } from "../../components/ui/QueryError";
import { useAuth } from "../../context/AuthContext";
import { formatNumber, formatUSD, relativeTime } from "../../lib/formatters";
import { can } from "../../lib/permissions";
import { useQueryParamState } from "../../lib/useQueryParamState";
import { BookingFormDialog } from "../bookings/BookingFormDialog";
import { CustomerDrawer } from "./CustomerDrawer";
import { CustomerFormDialog } from "./CustomerFormDialog";
import { CustomersToolbar } from "./CustomersToolbar";
import { useCustomersList } from "./useCustomersList";

const COLUMNS = [
  {
    key: "name",
    label: "Name",
    render: (customer) => (
      <span className="flex items-center gap-2.5">
        <Avatar name={customer.name} size={26} />
        <span className="font-medium text-text-primary">{customer.name}</span>
      </span>
    ),
  },
  {
    key: "phone",
    label: "Phone",
    render: (customer) => <span className="font-data text-text-secondary">{customer.phone}</span>,
  },
  { key: "area", label: "Area", render: (customer) => <span className="text-text-secondary">{customer.area}</span> },
  {
    key: "totalBookings",
    label: "Bookings",
    align: "right",
    render: (customer) => <span className="font-data">{formatNumber(customer.totalBookings)}</span>,
  },
  {
    key: "totalSpent",
    label: "Total spent",
    align: "right",
    render: (customer) => <span className="font-data font-medium">{formatUSD(customer.totalSpent)}</span>,
  },
  {
    key: "lastBookingAt",
    label: "Last booking",
    render: (customer) =>
      customer.lastBookingAt ? (
        <span className="font-data">{relativeTime(customer.lastBookingAt)}</span>
      ) : (
        <span className="text-text-secondary">No bookings</span>
      ),
  },
];

export function CustomersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const list = useCustomersList();
  const canManage = can(user, "customer.manage");
  const canCreateBooking = can(user, "booking.create");
  // ?customer=<id> opens the drawer (deep links from search, bookings...).
  const [selectedCustomerId, setSelectedCustomerId] = useQueryParamState("customer");
  const [drawerCustomerId, setDrawerCustomerId] = useState(selectedCustomerId);
  const [formState, setFormState] = useState(null);
  const [bookingFor, setBookingFor] = useState(null);

  if (selectedCustomerId && selectedCustomerId !== drawerCustomerId) {
    setDrawerCustomerId(selectedCustomerId);
  }

  return (
    <div className="flex flex-col gap-4">
      <CustomersToolbar
        {...list}
        actions={
          canManage && (
            <Button variant="primary" onClick={() => setFormState({ customer: null })}>
              <Plus size={14} />
              Add customer
            </Button>
          )
        }
      />

      <Card padded={false}>
        {list.isError ? (
          <QueryError message="Couldn't load customers." onRetry={list.refetch} />
        ) : (
          <DataTable
            columns={COLUMNS}
            data={list.items}
            getRowKey={(customer) => customer._id}
            onRowClick={(customer) => setSelectedCustomerId(customer._id)}
            isLoading={list.isLoading}
            isFetching={list.isFetching}
            skeletonRowCount={list.pageSize}
            emptyState={
              list.hasActiveFilters ? (
                <EmptyState
                  icon={UserRoundSearch}
                  title="No customers match your search"
                  description="Search by first or last name, or by phone number."
                  action={
                    <Button variant="secondary" onClick={list.clearFilters}>
                      Clear search
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={UserRoundSearch}
                  title="No customers yet"
                  description="Customers appear here when they book, or when you add one by hand."
                  action={
                    canManage && (
                      <Button variant="primary" onClick={() => setFormState({ customer: null })}>
                        <Plus size={14} />
                        Add customer
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
                label="customers"
              />
            }
          />
        )}
      </Card>

      <CustomerDrawer
        customerId={drawerCustomerId}
        open={Boolean(selectedCustomerId)}
        onClose={() => setSelectedCustomerId(null)}
        canManage={canManage}
        canOpenTickets={can(user, "ticket.read")}
        canCreateBooking={canCreateBooking}
        onEdit={(customer) => setFormState({ customer })}
        onNewBooking={(customer) => setBookingFor(customer)}
      />

      <CustomerFormDialog
        open={formState !== null}
        customer={formState?.customer}
        onClose={() => setFormState(null)}
        onSaved={(customer) => {
          if (!formState?.customer) setSelectedCustomerId(customer._id);
        }}
      />

      {canCreateBooking && (
        <BookingFormDialog
          open={bookingFor !== null}
          initialCustomer={bookingFor}
          onClose={() => setBookingFor(null)}
          onSaved={(booking) => navigate(`/bookings/${booking._id}`)}
        />
      )}
    </div>
  );
}
