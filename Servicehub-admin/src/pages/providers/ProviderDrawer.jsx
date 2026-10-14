import { BadgeCheck, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar } from "../../components/ui/Avatar";
import { DetailField } from "../../components/ui/DetailField";
import { Drawer } from "../../components/ui/Drawer";
import { QueryError } from "../../components/ui/QueryError";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useProvider } from "../../hooks/useProviders";
import { formatDate, formatNumber, formatUSD } from "../../lib/formatters";

function ProviderDrawerSkeleton() {
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

export function ProviderDrawer({ providerId, open, onClose }) {
  const { data, isLoading, isError, refetch } = useProvider(providerId);

  const provider = data?.provider;
  const earnings = data?.earnings ?? 0;
  const jobs = data?.jobs ?? 0;
  const recentJobs = data?.recentBookings ?? [];

  return (
    <Drawer open={open} onClose={onClose} title="Provider profile">
      {isError ? (
        <QueryError message="Couldn't load this provider." onRetry={refetch} />
      ) : isLoading || !provider ? (
        <ProviderDrawerSkeleton />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Avatar name={provider.name} size={48} />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-semibold text-text-primary">{provider.name}</span>
                {provider.verified && <BadgeCheck size={15} className="text-success" />}
              </div>
              <div className="text-[13px] text-text-secondary">{provider.area}</div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-[12px] text-text-secondary">Services</div>
            <div className="flex flex-wrap gap-1.5">
              {provider.services.map((service) => (
                <span
                  key={service}
                  className="rounded-btn border border-border px-2 py-1 text-[12px] text-text-primary"
                >
                  {service}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-card border border-border p-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-text-secondary">Rating</div>
              <div className="font-data mt-0.5 flex items-center gap-1 text-[15px] font-semibold text-text-primary">
                <Star size={12} className="shrink-0 text-text-secondary" />
                {provider.rating.toFixed(1)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-text-secondary">Jobs</div>
              <div className="font-data mt-0.5 text-[15px] font-semibold text-text-primary">
                {formatNumber(jobs)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-text-secondary">Earnings</div>
              <div className="font-data mt-0.5 text-[15px] font-semibold text-text-primary">
                {formatUSD(earnings)}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <DetailField label="Phone" mono>
              {provider.phone}
            </DetailField>
            <DetailField label="Area">{provider.area}</DetailField>
            <DetailField label="Joined" mono>
              {formatDate(provider.joinedAt)}
            </DetailField>
          </div>

          <div>
            <div className="mb-2 text-[13px] font-semibold text-text-primary">Recent jobs</div>
            {recentJobs.length === 0 ? (
              <p className="text-[13px] text-text-secondary">No jobs yet.</p>
            ) : (
              <div className="flex flex-col">
                {recentJobs.map((booking) => (
                  <Link
                    key={booking._id}
                    to={`/bookings/${booking._id}`}
                    className="flex items-center gap-3 border-b border-border py-2.5 text-[13px] last:border-0 hover:bg-canvas"
                  >
                    <span className="font-data w-16 shrink-0 text-text-secondary">{booking.code}</span>
                    <span className="min-w-0 flex-1 truncate text-text-primary">
                      {booking.customer?.name ?? "Unknown"}
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
        </div>
      )}
    </Drawer>
  );
}
