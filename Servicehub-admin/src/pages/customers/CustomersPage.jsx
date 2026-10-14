import { UserRoundSearch } from "lucide-react";
import { useState } from "react";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { QueryError } from "../../components/ui/QueryError";
import { formatNumber, formatUSD, relativeTime } from "../../lib/formatters";
import { CustomerDrawer } from "./CustomerDrawer";
import { CustomersToolbar } from "./CustomersToolbar";
import { useCustomersList } from "./useCustomersList";

const COLUMNS = [
  {
    key: "name",
    label: "Name",
    render: (customer) => (
      <div className="flex items-center gap-2.5">
        <Avatar name={customer.name} size={24} />
        <span className="text-text-primary">{customer.name}</span>
      </div>
    ),
  },
  {
    key: "phone",
    label: "Phone",
    render: (customer) => <span className="font-data text-text-secondary">{customer.phone}</span>,
  },
  { key: "area", label: "Area" },
  {
    key: "totalBookings",
    label: "Bookings",
    render: (customer) => <span className="font-data">{formatNumber(customer.totalBookings)}</span>,
  },
  {
    key: "totalSpent",
    label: "Total Spent",
    align: "right",
    render: (customer) => <span className="font-data">{formatUSD(customer.totalSpent)}</span>,
  },
  {
    key: "lastBookingAt",
    label: "Last Booking",
    render: (customer) =>
      customer.lastBookingAt ? (
        <span className="font-data">{relativeTime(customer.lastBookingAt)}</span>
      ) : (
        <span className="font-data text-text-secondary">—</span>
      ),
  },
];

export function CustomersPage() {
  const list = useCustomersList();
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  function handleRowClick(customer) {
    setSelectedCustomerId(customer._id);
    setIsDrawerOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <CustomersToolbar {...list} />

      <Card padded={false}>
        {list.isError ? (
          <QueryError message="Couldn't load customers." onRetry={list.refetch} />
        ) : (
          <DataTable
            columns={COLUMNS}
            data={list.items}
            getRowKey={(customer) => customer._id}
            onRowClick={handleRowClick}
            isLoading={list.isLoading}
            skeletonRowCount={8}
            emptyState={
              <div className="flex flex-col items-center gap-3">
                <UserRoundSearch size={28} className="text-text-secondary" />
                <p className="text-[13px] text-text-secondary">No customers match your search</p>
                <Button variant="ghost" onClick={list.clearFilters}>
                  Clear filters
                </Button>
              </div>
            }
          />
        )}
      </Card>

      <CustomerDrawer
        customerId={selectedCustomerId}
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}
