import clsx from "clsx";
import { ReceiptText } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { QueryError } from "../../components/ui/QueryError";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatUSD, relativeTime } from "../../lib/formatters";
import { RefundDrawer } from "./RefundDrawer";
import { TABS, useRefundsList } from "./useRefundsList";

const TAB_LABELS = { pending: "Pending", approved: "Approved", rejected: "Rejected" };

const COLUMNS = [
  {
    key: "code",
    label: "ID",
    render: (refund) => <span className="font-data text-text-secondary">{refund.code}</span>,
  },
  {
    key: "booking",
    label: "Booking",
    render: (refund) =>
      refund.booking ? (
        <Link
          to={`/bookings/${refund.booking._id}`}
          onClick={(event) => event.stopPropagation()}
          className="font-data text-accent hover:underline"
        >
          {refund.booking.code}
        </Link>
      ) : (
        <span className="text-text-secondary">—</span>
      ),
  },
  {
    key: "customerName",
    label: "Customer",
    render: (refund) => refund.booking?.customer?.name ?? "Unknown",
  },
  {
    key: "amount",
    label: "Amount",
    align: "right",
    render: (refund) => <span className="font-data">{formatUSD(refund.amount)}</span>,
  },
  {
    key: "reason",
    label: "Reason",
    render: (refund) => (
      <span className="block max-w-55 truncate text-text-secondary">{refund.reason}</span>
    ),
  },
  {
    key: "createdAt",
    label: "Requested",
    render: (refund) => <span className="font-data">{relativeTime(refund.createdAt)}</span>,
  },
  {
    key: "requestedByName",
    label: "Requested By",
    render: (refund) => refund.requestedBy?.name ?? "Unknown",
  },
  {
    key: "status",
    label: "Status",
    render: (refund) => <StatusBadge status={refund.status} />,
  },
];

export function RefundsPage() {
  const list = useRefundsList();
  const [selectedRefundId, setSelectedRefundId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  function handleRowClick(refund) {
    setSelectedRefundId(refund._id);
    setIsDrawerOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex w-fit rounded-btn border border-border bg-canvas p-0.5">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => list.setActiveTab(tab)}
            className={clsx(
              "flex items-center gap-1.5 rounded-btn px-3 py-1.5 text-[13px] transition-colors",
              list.activeTab === tab
                ? "bg-surface text-text-primary shadow-card"
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            {TAB_LABELS[tab]}
            <span className="font-data text-[12px] text-text-secondary">{list.counts[tab]}</span>
          </button>
        ))}
      </div>

      <Card padded={false}>
        {list.isError ? (
          <QueryError message="Couldn't load refunds." onRetry={list.refetch} />
        ) : (
          <DataTable
            columns={COLUMNS}
            data={list.filteredRefunds}
            getRowKey={(refund) => refund._id}
            getRowClassName={(refund) =>
              refund._id === list.pulseRefundId ? "animate-highlight-pulse" : undefined
            }
            onRowClick={handleRowClick}
            isLoading={list.isLoading}
            skeletonRowCount={5}
            emptyState={
              <div className="flex flex-col items-center gap-3">
                <ReceiptText size={28} className="text-text-secondary" />
                <p className="text-[13px] text-text-secondary">
                  No {TAB_LABELS[list.activeTab].toLowerCase()} refund requests
                </p>
              </div>
            }
          />
        )}
      </Card>

      <RefundDrawer
        refundId={selectedRefundId}
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onDecided={list.setPulseRefundId}
      />
    </div>
  );
}
