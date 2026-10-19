import { BadgeCheck, BriefcaseBusiness, CalendarClock, CalendarDays, MapPin, Pencil, Phone, Star } from "lucide-react";
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
import { useDeleteProvider, useProvider, useUpdateProvider } from "../../hooks/useProviders";
import { errorMessage } from "../../lib/api";
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

export function ProviderDrawer({ providerId, open, onClose, canManage, onEdit }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data, isLoading, isError, error, refetch } = useProvider(providerId);
  const updateMutation = useUpdateProvider(providerId);
  const deleteMutation = useDeleteProvider();

  const provider = data?.provider;
  const recentJobs = data?.recentBookings ?? [];
  const notFound = error?.response?.status === 404;

  function toggle(field) {
    const nextValue = !provider[field];
    updateMutation.mutate(
      { [field]: nextValue },
      {
        onSuccess: (detail) => {
          const label =
            field === "isAvailable"
              ? nextValue
                ? "is now available for new jobs"
                : "is now off duty"
              : nextValue
                ? "is now verified"
                : "is no longer marked verified";
          toast.success(`${detail.provider.name} ${label}.`);
        },
        onError: (err) => toast.error(errorMessage(err)),
      }
    );
  }

  async function handleDelete() {
    const { _id: id, name } = provider;
    const deleted = await confirm({
      title: `Delete ${name}?`,
      description: "Their profile is removed for good. This can't be undone.",
      confirmLabel: "Delete provider",
      pendingLabel: "Deleting…",
      tone: "danger",
      onConfirm: () => deleteMutation.mutateAsync(id),
    });
    if (deleted) {
      toast.success(`${name} deleted.`);
      onClose();
    }
  }

  const bookingCount = data?.totalBookings ?? recentJobs.length;

  return (
    <Drawer open={open} onClose={onClose} title="Provider profile">
      {isError ? (
        <QueryError
          message={notFound ? "This provider doesn't exist anymore." : "Couldn't load this provider."}
          onRetry={notFound ? undefined : refetch}
        />
      ) : isLoading || !provider ? (
        <ProviderDrawerSkeleton />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar name={provider.name} size={48} />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[15px] font-semibold text-text-primary">{provider.name}</span>
                  {provider.verified && <BadgeCheck size={15} className="text-success" aria-label="Verified" />}
                </div>
                <div className="mt-0.5">
                  <StatusBadge status={provider.isAvailable ? "available" : "off_duty"} />
                </div>
              </div>
            </div>
            {canManage && (
              <Button variant="ghost" onClick={() => onEdit(provider)} aria-label="Edit provider">
                <Pencil size={14} />
                Edit
              </Button>
            )}
          </div>

          <div>
            <div className="mb-2 text-[12px] text-text-secondary">Services</div>
            <div className="flex flex-wrap gap-1.5">
              {provider.services.map((service) => (
                <span
                  key={service}
                  className="inline-flex items-center gap-1.5 rounded-btn border border-border py-1 pl-1 pr-2 text-[12px] text-text-primary"
                >
                  <ServiceIcon service={service} size={20} />
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
                {formatNumber(data.jobs)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-text-secondary">Earnings</div>
              <div className="font-data mt-0.5 text-[15px] font-semibold text-text-primary">
                {formatUSD(data.earnings)}
              </div>
            </div>
          </div>

          <InfoList>
            <InfoRow icon={Phone} label="Phone" mono>
              {provider.phone}
            </InfoRow>
            <InfoRow icon={MapPin} label="Area">
              {provider.area}
            </InfoRow>
            <InfoRow icon={CalendarClock} label="Active bookings" mono>
              {formatNumber(data.activeBookings ?? 0)}
            </InfoRow>
            <InfoRow icon={BriefcaseBusiness} label="Lifetime jobs" mono>
              {formatNumber(provider.jobsCompleted)}
            </InfoRow>
            <InfoRow icon={CalendarDays} label="Joined" mono>
              {formatDate(provider.joinedAt)}
            </InfoRow>
          </InfoList>

          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={updateMutation.isPending} onClick={() => toggle("isAvailable")}>
                {provider.isAvailable ? "Mark off duty" : "Mark available"}
              </Button>
              <Button variant="secondary" disabled={updateMutation.isPending} onClick={() => toggle("verified")}>
                {provider.verified ? "Remove verification" : "Mark verified"}
              </Button>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-text-primary">Recent jobs</span>
            </div>
            {recentJobs.length === 0 ? (
              <p className="text-[13px] text-text-secondary">No jobs yet.</p>
            ) : (
              <div className="flex flex-col">
                {recentJobs.map((booking) => (
                  <Link
                    key={booking._id}
                    to={`/bookings/${booking._id}`}
                    className="-mx-2 flex items-center gap-3 rounded-btn px-2 py-2 text-[13px] transition-colors hover:bg-canvas"
                  >
                    <ServiceIcon service={booking.service} size={24} />
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

          {canManage && (
            <DangerZone
              title="Delete provider"
              description="Removes this profile for good. Possible only while they have no bookings."
              disabled={bookingCount > 0}
              disabledReason={`${provider.name} has ${formatNumber(bookingCount)} booking${bookingCount === 1 ? "" : "s"} on record, so the profile stays for your records. Mark them off duty to stop new jobs.`}
              actionLabel="Delete provider"
              onAction={handleDelete}
              isPending={deleteMutation.isPending}
            />
          )}
        </div>
      )}
    </Drawer>
  );
}
