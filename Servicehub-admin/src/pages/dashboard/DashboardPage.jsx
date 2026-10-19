import clsx from "clsx";
import { CalendarCheck2, LifeBuoy, Plus, ReceiptText, UsersRound, Wallet } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookingsByStatusCard } from "../../components/BookingsByStatusCard";
import { BookingsTrendChart } from "../../components/BookingsTrendChart";
import { DashboardHeader } from "../../components/dashboard/DashboardHeader";
import { DeltaPill, KpiStrip } from "../../components/dashboard/KpiStrip";
import { OpenTicketsCard } from "../../components/OpenTicketsCard";
import { PendingRefundsCard } from "../../components/PendingRefundsCard";
import { RecentBookingsCard } from "../../components/RecentBookingsCard";
import { RequestRefundDialog } from "../../components/refunds/RequestRefundDialog";
import { Button } from "../../components/ui/Button";
import { QueryError } from "../../components/ui/QueryError";
import { useAuth } from "../../context/AuthContext";
import { useDashboardSummary } from "../../hooks/useDashboard";
import { useDashboardRange } from "../../layouts/dashboardRange";
import { formatMonth, formatNumber, formatUSD } from "../../lib/formatters";
import { can } from "../../lib/permissions";
import { BookingFormDialog } from "../bookings/BookingFormDialog";

const RANGE_COPY = {
  today: { period: "Today", previous: "vs yesterday", soFar: "vs this time yesterday" },
  week: { period: "This week", previous: "vs last week", soFar: "vs this point last week" },
  month: { period: "This month", previous: "vs last month", soFar: "vs this point last month" },
};

function summaryLine(range) {
  if (range === "today") return "Here's today so far.";
  if (range === "month") return `Here's how ${formatMonth(new Date())} is going.`;
  return "Here's how this week is going.";
}

// Signed change; `invert` when a rise is bad news (e.g. new tickets).
function deltaTone(percent, invert = false) {
  if (!percent) return "neutral";
  return percent > 0 !== invert ? "positive" : "negative";
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [range] = useDashboardRange();
  const { data, isLoading, isFetching, isError, refetch } = useDashboardSummary(range);
  const [openDialog, setOpenDialog] = useState(null);
  const copy = RANGE_COPY[range];
  const canSeeTickets = can(user, "ticket.read");
  const canCreateBooking = can(user, "booking.create");
  const canRequestRefund = can(user, "refund.request");
  const firstName = user.name.split(" ")[0];

  const actions = (
    <>
      {canRequestRefund && (
        <Button variant="secondary" onClick={() => setOpenDialog("refund")}>
          <ReceiptText size={14} />
          New refund
        </Button>
      )}
      {canCreateBooking && (
        <Button variant="primary" onClick={() => setOpenDialog("booking")}>
          <Plus size={14} />
          New booking
        </Button>
      )}
    </>
  );

  const dialogs = (
    <>
      {canCreateBooking && (
        <BookingFormDialog
          open={openDialog === "booking"}
          onClose={() => setOpenDialog(null)}
          onSaved={(booking) => navigate(`/bookings/${booking._id}`)}
        />
      )}
      {canRequestRefund && <RequestRefundDialog open={openDialog === "refund"} onClose={() => setOpenDialog(null)} />}
    </>
  );

  if (isError) {
    return (
      <div className="flex flex-col gap-5">
        <DashboardHeader firstName={firstName} summary={summaryLine(range)} actions={actions} />
        <QueryError message="Couldn't load the dashboard." onRetry={refetch} />
        {dialogs}
      </div>
    );
  }

  const kpis = data?.kpis ?? {};
  const trend = data?.trend ?? [];

  const kpiItems = [
    {
      icon: CalendarCheck2,
      label: `Bookings, ${copy.period.toLowerCase()}`,
      value: formatNumber(kpis.bookings ?? 0),
      delta: <DeltaPill percent={kpis.bookingsDelta} tone={deltaTone(kpis.bookingsDelta)} />,
      context: copy.previous,
      trend: trend.map((day) => day.count),
      trendLabel: `Bookings per day, last ${trend.length} days`,
    },
    {
      icon: Wallet,
      label: `Revenue, ${copy.period.toLowerCase()}`,
      value: formatUSD(kpis.revenue ?? 0),
      delta: <DeltaPill percent={kpis.revenueDelta} tone={deltaTone(kpis.revenueDelta)} />,
      context: copy.soFar,
      trend: trend.map((day) => day.revenue ?? 0),
      trendLabel: `Revenue per day, last ${trend.length} days`,
    },
    canSeeTickets
      ? {
          icon: LifeBuoy,
          label: "Active tickets",
          value: formatNumber(kpis.activeTickets ?? 0),
          // More new tickets is bad news, hence inverted.
          delta: <DeltaPill percent={kpis.newTicketsDelta} tone={deltaTone(kpis.newTicketsDelta, true)} />,
          context: `${formatNumber(kpis.newTickets ?? 0)} new, ${copy.soFar}`,
        }
      : {
          // Finance can't open Support; it sees what's waiting for its approval.
          icon: ReceiptText,
          label: "Pending refunds",
          value: formatNumber(data?.pendingRefunds?.count ?? 0),
          context: `${formatUSD(data?.pendingRefunds?.total ?? 0)} waiting for a decision`,
        },
    {
      icon: UsersRound,
      label: "Available providers",
      value: (
        <>
          {formatNumber(kpis.availableProviders ?? 0)}
          <span className="text-[15px] font-medium text-text-secondary"> / {formatNumber(kpis.totalProviders ?? 0)}</span>
        </>
      ),
      context: `${kpis.totalProviders ? Math.round(((kpis.availableProviders ?? 0) / kpis.totalProviders) * 100) : 0}% of the fleet can take jobs`,
      meter: {
        value: kpis.availableProviders ?? 0,
        max: kpis.totalProviders ?? 0,
        label: "Providers available",
      },
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <DashboardHeader firstName={firstName} summary={summaryLine(range)} actions={actions} />

      {/* While another period loads, the current numbers stay in place, dimmed. */}
      <div
        className={clsx("flex flex-col gap-5 transition-opacity duration-150", isFetching && !isLoading && "opacity-60")}
        aria-busy={isFetching}
      >
        <KpiStrip items={kpiItems} isLoading={isLoading} />

        <div className="grid grid-cols-1 gap-5 min-[900px]:grid-cols-3">
          <div className="min-[900px]:col-span-2">
            <BookingsTrendChart data={trend} isLoading={isLoading} />
          </div>
          <BookingsByStatusCard data={data?.statusBreakdown ?? []} isLoading={isLoading} periodLabel={copy.period} />
        </div>

        <div className="grid grid-cols-1 gap-5 min-[900px]:grid-cols-2">
          <RecentBookingsCard bookings={data?.recentBookings ?? []} isLoading={isLoading} />
          {canSeeTickets ? (
            <OpenTicketsCard tickets={data?.openTickets ?? []} isLoading={isLoading} />
          ) : (
            <PendingRefundsCard refunds={data?.pendingRefunds?.items ?? []} isLoading={isLoading} />
          )}
        </div>
      </div>

      {dialogs}
    </div>
  );
}
