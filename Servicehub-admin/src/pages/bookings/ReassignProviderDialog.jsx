import { BadgeCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Skeleton } from "../../components/ui/Skeleton";
import { useToast } from "../../context/ToastContext";
import { useReassignBooking } from "../../hooks/useBookings";
import { useProviders } from "../../hooks/useProviders";
import { errorMessage } from "../../lib/api";
import { formatNumber } from "../../lib/formatters";

// Lists available providers who offer the booking's service (the API
// enforces the same rules) and assigns the chosen one.
function ReassignForm({ booking, onClose }) {
  const toast = useToast();
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState(null);
  const mutation = useReassignBooking(booking._id);
  const providersQuery = useProviders({ service: booking.service, availableOnly: "true", limit: 50 });

  const currentProviderId = booking.provider?._id;
  const candidates = (providersQuery.data?.items ?? []).filter((provider) => provider._id !== currentProviderId);
  const isAssigning = !currentProviderId;

  function handleSelect(provider) {
    setError("");
    setPendingId(provider._id);
    mutation.mutate(provider._id, {
      onSuccess: () => {
        toast.success(`${booking.code} ${isAssigning ? "assigned" : "reassigned"} to ${provider.name}.`);
        onClose();
      },
      onError: (err) => setError(errorMessage(err, "Couldn't reassign this booking.")),
      onSettled: () => setPendingId(null),
    });
  }

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title={isAssigning ? "Assign provider" : "Reassign provider"}
      description={`Available ${booking.service} providers${currentProviderId ? `, other than ${booking.provider.name}` : ""}.`}
    >
      {error && (
        <p role="alert" className="mb-3 text-[13px] text-danger">
          {error}
        </p>
      )}
      {providersQuery.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <p>No other available providers offer {booking.service} right now.</p>
      ) : (
        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {candidates.map((provider) => (
            <div
              key={provider._id}
              className="flex items-center justify-between gap-3 rounded-btn border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[13px] font-medium text-text-primary">
                  <span className="truncate">{provider.name}</span>
                  {provider.verified && <BadgeCheck size={13} className="shrink-0 text-success" aria-label="Verified" />}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[12px] text-text-secondary">
                  <span className="font-data">{provider.rating.toFixed(1)} rating</span>
                  <span>·</span>
                  <span className="font-data">{formatNumber(provider.jobsCompleted)} jobs</span>
                  <span>·</span>
                  <span className="truncate">{provider.area}</span>
                </div>
              </div>
              <Button
                variant="secondary"
                disabled={mutation.isPending}
                onClick={() => handleSelect(provider)}
              >
                {pendingId === provider._id ? "Assigning…" : "Select"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </ConfirmDialog>
  );
}

export function ReassignProviderDialog({ open, ...props }) {
  return open ? <ReassignForm {...props} /> : null;
}
