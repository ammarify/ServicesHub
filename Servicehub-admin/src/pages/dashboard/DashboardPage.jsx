import { BookingsByStatusCard } from "../../components/BookingsByStatusCard";
import { BookingsTrendChart } from "../../components/BookingsTrendChart";
import { OpenTicketsCard } from "../../components/OpenTicketsCard";
import { RecentBookingsCard } from "../../components/RecentBookingsCard";
import { StatCard } from "../../components/StatCard";
import { QueryError } from "../../components/ui/QueryError";
import { formatNumber, formatUSD } from "../../lib/formatters";
import { useDashboardSummary } from "../../hooks/useDashboard";

function buildDelta(percent, { invert = false, suffix = "vs last week" } = {}) {
  if (percent === 0) return { label: `No change ${suffix}`, tone: "neutral" };
  const isPositive = percent > 0;
  const tone = isPositive !== invert ? "positive" : "negative";
  return { label: `${isPositive ? "+" : ""}${percent}% ${suffix}`, tone };
}

function buildAvailabilityDelta(available, total) {
  const percent = total === 0 ? 0 : Math.round((available / total) * 100);
  const tone = percent >= 70 ? "positive" : percent >= 40 ? "neutral" : "negative";
  return { label: `${percent}% of fleet available`, tone };
}

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboardSummary();

  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-[15px] font-semibold text-text-primary">Overview</h2>
        <QueryError message="Couldn't load the dashboard." onRetry={refetch} />
      </div>
    );
  }

  const kpis = data?.kpis ?? {};
  const last14Days = data?.last14Days ?? [];
  const statusBreakdown = data?.statusBreakdown ?? [];
  const recentBookings = data?.recentBookings ?? [];
  const openTickets = data?.openTickets ?? [];

  const todaysBookingsDelta = buildDelta(kpis.todaysBookingsDelta ?? 0, { suffix: "vs yesterday" });
  const ticketsDelta = buildDelta(kpis.ticketsDelta ?? 0, { invert: true, suffix: "new this week" });
  const revenueDelta = buildDelta(kpis.revenueDelta ?? 0, { suffix: "vs last week" });
  const availabilityDelta = buildAvailabilityDelta(kpis.availableProviders ?? 0, kpis.totalProviders ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[15px] font-semibold text-text-primary">Overview</h2>

      <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-4">
        <StatCard
          label="Today's Bookings"
          value={formatNumber(kpis.todaysBookings ?? 0)}
          deltaLabel={todaysBookingsDelta.label}
          deltaTone={todaysBookingsDelta.tone}
          isLoading={isLoading}
        />
        <StatCard
          label="Active Tickets"
          value={formatNumber(kpis.activeTickets ?? 0)}
          deltaLabel={ticketsDelta.label}
          deltaTone={ticketsDelta.tone}
          isLoading={isLoading}
        />
        <StatCard
          label="Revenue (This Week)"
          value={formatUSD(kpis.revenueThisWeek ?? 0)}
          deltaLabel={revenueDelta.label}
          deltaTone={revenueDelta.tone}
          isLoading={isLoading}
        />
        <StatCard
          label="Available Providers"
          value={`${formatNumber(kpis.availableProviders ?? 0)}/${formatNumber(kpis.totalProviders ?? 0)}`}
          deltaLabel={availabilityDelta.label}
          deltaTone={availabilityDelta.tone}
          isLoading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-3">
        <div className="min-[900px]:col-span-2">
          <BookingsTrendChart data={last14Days} isLoading={isLoading} />
        </div>
        <BookingsByStatusCard data={statusBreakdown} isLoading={isLoading} />
      </div>

      <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
        <RecentBookingsCard bookings={recentBookings} isLoading={isLoading} />
        <OpenTicketsCard tickets={openTickets} isLoading={isLoading} />
      </div>
    </div>
  );
}
