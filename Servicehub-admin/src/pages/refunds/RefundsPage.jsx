import clsx from "clsx";
import { Plus, ReceiptText } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { RequestRefundDialog } from "../../components/refunds/RequestRefundDialog";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { EmptyState } from "../../components/ui/EmptyState";
import { Pagination } from "../../components/ui/Pagination";
import { QueryError } from "../../components/ui/QueryError";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { formatUSD, relativeTime } from "../../lib/formatters";
import { can } from "../../lib/permissions";
import { useQueryParamState } from "../../lib/useQueryParamState";
import { RefundDrawer } from "./RefundDrawer";
import { TABS, useRefundsList } from "./useRefundsList";

const TAB_LABELS = { pending: "Pending", approved: "Approved", rejected: "Rejected" };

const EMPTY_COPY = {
  pending: { title: "Nothing waiting for a decision", description: "New refund requests show up here, and approvers are notified as they arrive." },
  approved: { title: "No approved refunds yet", description: "Refunds you approve are listed here with who decided and when." },
  rejected: { title: "No rejected refunds", description: "Refunds you turn down are listed here with the reason given." },
};

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
    render: (refund) => (
      <span className="flex items-center gap-2.5">
        <Avatar name={refund.booking?.customer?.name ?? "?"} size={26} />
        <span className="font-medium">{refund.booking?.customer?.name ?? "Unknown"}</span>
      </span>
    ),
  },
  {
    key: "amount",
    label: "Amount",
    align: "right",
    render: (refund) => <span className="font-data font-medium">{formatUSD(refund.amount)}</span>,
  },
  {
    key: "reason",
    label: "Reason",
    render: (refund) => <span className="block max-w-60 truncate text-text-secondary">{refund.reason}</span>,
  },
  {
    key: "createdAt",
    label: "Requested",
    render: (refund) => <span className="font-data">{relativeTime(refund.createdAt)}</span>,
  },
  {
    key: "requestedByName",
    label: "Requested by",
    render: (refund) => refund.requestedBy?.name ?? "Unknown",
  },
  {
    key: "status",
    label: "Status",
    render: (refund) => <StatusBadge status={refund.status} />,
  },
];

export function RefundsPage() {
  const { user } = useAuth();
  const list = useRefundsList();
  // ?refund=<id> opens the drawer (links from notifications and bookings).
  const [selectedRefundId, setSelectedRefundId] = useQueryParamState("refund");
  const [drawerRefundId, setDrawerRefundId] = useState(selectedRefundId);
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  // ?new=1 opens the request form too (the command palette's "Request a refund").
  const [newParam, setNewParam] = useQueryParamState("new");

  if (selectedRefundId && selectedRefundId !== drawerRefundId) {
    setDrawerRefundId(selectedRefundId);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex w-fit rounded-btn border border-border bg-canvas p-0.5" role="tablist" aria-label="Refund status">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={list.activeTab === tab}
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

        {can(user, "refund.request") && (
          <Button variant="primary" onClick={() => setIsRequestOpen(true)}>
            <Plus size={14} />
            New refund
          </Button>
        )}
      </div>

      <Card padded={false}>
        {list.isError ? (
          <QueryError message="Couldn't load refunds." onRetry={list.refetch} />
        ) : (
          <DataTable
            columns={COLUMNS}
            data={list.items}
            getRowKey={(refund) => refund._id}
            getRowClassName={(refund) => (refund._id === list.pulseRefundId ? "animate-highlight-pulse" : undefined)}
            onRowClick={(refund) => setSelectedRefundId(refund._id)}
            isLoading={list.isLoading}
            isFetching={list.isFetching}
            skeletonRowCount={5}
            emptyState={
              <EmptyState
                icon={ReceiptText}
                title={EMPTY_COPY[list.activeTab].title}
                description={EMPTY_COPY[list.activeTab].description}
              />
            }
            footer={
              <Pagination
                page={list.page}
                pageSize={list.pageSize}
                total={list.totalCount}
                totalPages={list.totalPages}
                onPageChange={list.setPage}
                onPageSizeChange={list.setPageSize}
                label="refunds"
              />
            }
          />
        )}
      </Card>

      <RefundDrawer
        refundId={drawerRefundId}
        open={Boolean(selectedRefundId)}
        onClose={() => setSelectedRefundId(null)}
        onDecided={list.setPulseRefundId}
      />

      <RequestRefundDialog
        open={isRequestOpen || newParam === "1"}
        onClose={() => {
          setIsRequestOpen(false);
          if (newParam) setNewParam(null, { replace: true });
        }}
        onCreated={(refund) => {
          list.setActiveTab("pending");
          list.setPulseRefundId(refund._id);
        }}
      />
    </div>
  );
}
