import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { QueryError } from "../../components/ui/QueryError";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { useBooking, useCancelBooking, useReassignBooking } from "../../hooks/useBookings";
import { useCustomer } from "../../hooks/useCustomers";
import { useProviders } from "../../hooks/useProviders";
import { can } from "../../lib/permissions";
import { BookingCustomerCard } from "./BookingCustomerCard";
import { BookingPaymentCard } from "./BookingPaymentCard";
import { BookingProviderCard } from "./BookingProviderCard";
import { BookingTimelineCard } from "./BookingTimelineCard";
import { ReassignProviderDialog } from "./ReassignProviderDialog";

export function BookingDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [reassignError, setReassignError] = useState("");

  const bookingQuery = useBooking(id);
  const booking = bookingQuery.data;

  const customerQuery = useCustomer(booking?.customer?._id);
  const customer = customerQuery.data?.customer;

  const providersQuery = useProviders({ service: booking?.service, limit: 50 });

  const reassignMutation = useReassignBooking(id);
  const cancelMutation = useCancelBooking(id);

  const canManage = can(user.role, "booking.reassign");

  const reassignCandidates = useMemo(() => {
    const allProviders = providersQuery.data?.items ?? [];
    if (!booking) return [];
    return allProviders.filter((p) => p._id !== booking.provider?._id);
  }, [providersQuery.data, booking]);

  if (bookingQuery.isError) {
    const notFound = bookingQuery.error?.response?.status === 404;

    if (notFound) {
      return (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-[13px] text-text-secondary">Booking not found.</p>
          <Link to="/bookings" className="text-[13px] text-accent hover:underline">
            Back to bookings
          </Link>
        </div>
      );
    }

    return <QueryError message="Couldn't load this booking." onRetry={bookingQuery.refetch} />;
  }

  function handleReassign(newProviderId) {
    setReassignError("");
    reassignMutation.mutate(newProviderId, {
      onSuccess: () => setIsReassignOpen(false),
      onError: (error) => {
        setReassignError(error.response?.data?.message ?? "Couldn't reassign this booking.");
      },
    });
  }

  function handleCancel() {
    cancelMutation.mutate(undefined, {
      onSuccess: () => setIsCancelOpen(false),
    });
  }

  const isLoading = bookingQuery.isLoading;
  const status = booking?.status;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <Link
          to="/bookings"
          className="inline-flex w-fit items-center gap-1.5 text-[13px] text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={14} />
          Back to bookings
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="font-data text-[20px] font-semibold text-text-primary">
              {booking?.code ?? ""}
            </h1>
            {status && <StatusBadge status={status} />}
          </div>

          {canManage && booking && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setIsReassignOpen(true)}>
                Reassign provider
              </Button>
              <Button
                variant="ghost"
                tone="danger"
                disabled={status === "cancelled"}
                onClick={() => setIsCancelOpen(true)}
              >
                Cancel booking
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-3">
        <div className="min-[900px]:col-span-2">
          <BookingTimelineCard timeline={booking?.timeline ?? []} isLoading={isLoading} />
        </div>
        <div className="flex flex-col gap-4">
          <BookingCustomerCard
            customer={customer}
            isLoading={isLoading || customerQuery.isLoading}
          />
          <BookingProviderCard provider={booking?.provider} isLoading={isLoading} />
          <BookingPaymentCard booking={booking} isLoading={isLoading} />
        </div>
      </div>

      <ReassignProviderDialog
        open={isReassignOpen}
        onClose={() => {
          setIsReassignOpen(false);
          setReassignError("");
        }}
        candidates={reassignCandidates}
        onSelect={handleReassign}
        isSubmitting={reassignMutation.isPending}
        error={reassignError}
      />

      <ConfirmDialog
        open={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        title="Cancel booking"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCancelOpen(false)}>
              Keep booking
            </Button>
            <Button
              variant="secondary"
              tone="danger"
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling…" : "Cancel booking"}
            </Button>
          </>
        }
      >
        {cancelMutation.isError && (
          <p className="mb-2 text-danger">
            {cancelMutation.error?.response?.data?.message ?? "Couldn't cancel this booking."}
          </p>
        )}
        <p>
          Are you sure you want to cancel booking{" "}
          <span className="font-data text-text-primary">{booking?.code}</span>? This action
          cannot be undone.
        </p>
      </ConfirmDialog>
    </div>
  );
}
