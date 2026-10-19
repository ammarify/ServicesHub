import { useState } from "react";
import { useBooking } from "../../hooks/useBookings";
import { useBookingOptions } from "../../hooks/usePickerOptions";
import { useRequestRefund } from "../../hooks/useRefunds";
import { useToast } from "../../context/ToastContext";
import { errorMessage, fieldErrors } from "../../lib/api";
import { formatUSD } from "../../lib/formatters";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { FormField } from "../ui/FormField";
import { Input } from "../ui/Input";
import { SearchSelect } from "../ui/SearchSelect";
import { Skeleton } from "../ui/Skeleton";
import { StatusBadge } from "../ui/StatusBadge";
import { Textarea } from "../ui/Textarea";

function RefundForm({ fixedBookingId, defaultAmount, defaultReason, onClose, onCreated }) {
  const toast = useToast();
  const [pickedBooking, setPickedBooking] = useState(null);
  const bookingId = fixedBookingId ?? pickedBooking?._id ?? null;
  const bookingQuery = useBooking(bookingId);
  const booking = bookingQuery.data;
  const summary = booking?.refundSummary;
  const hasPendingRequest = (summary?.pendingTotal ?? 0) > 0;

  const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount) : "");
  const [reason, setReason] = useState(defaultReason ?? "");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const mutation = useRequestRefund();

  function handleSubmit() {
    const nextErrors = {};
    if (!bookingId) nextErrors.bookingId = "Pick the booking to refund";
    const value = Number(amount);
    if (!amount || !Number.isFinite(value) || value <= 0) nextErrors.amount = "Enter an amount greater than zero";
    else if (summary && value > summary.refundable) {
      nextErrors.amount = `At most ${formatUSD(summary.refundable)} can still be refunded`;
    }
    if (!reason.trim()) nextErrors.reason = "Explain why the customer should be refunded";
    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length > 0) return;

    mutation.mutate(
      { bookingId, amount: value, reason: reason.trim() },
      {
        onSuccess: (refund) => {
          toast.success(`Refund ${refund.code} requested. An approver has been notified.`);
          onCreated?.(refund);
          onClose();
        },
        onError: (error) => {
          const apiErrors = fieldErrors(error);
          if (Object.keys(apiErrors).length > 0) setErrors(apiErrors);
          else setFormError(errorMessage(error));
        },
      }
    );
  }

  const cannotRequest = summary && (summary.refundable <= 0 || hasPendingRequest);

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title="Request refund"
      description="Refund requests are reviewed by a manager or finance before money moves."
      onSubmit={handleSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={mutation.isPending || Boolean(cannotRequest)}>
            {mutation.isPending ? "Submitting…" : "Submit request"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-left">
        {!fixedBookingId && (
          <FormField label="Booking" error={errors.bookingId}>
            <SearchSelect
              value={pickedBooking}
              onChange={setPickedBooking}
              useOptions={useBookingOptions}
              getKey={(item) => item._id}
              placeholder="Search by booking ID or customer…"
              emptyText="No bookings match"
              renderOption={(item) => (
                <span className="flex w-full items-center gap-3">
                  <span className="font-data w-16 shrink-0 text-[12px] text-text-secondary">{item.code}</span>
                  <span className="min-w-0 flex-1 truncate text-text-primary">
                    {item.customer?.name ?? "Unknown"} · {item.service}
                  </span>
                  <span className="font-data shrink-0 text-[12px] text-text-primary">{formatUSD(item.amount)}</span>
                </span>
              )}
            />
          </FormField>
        )}

        {bookingId && (
          <div className="rounded-card border border-border p-3">
            {bookingQuery.isLoading || !booking ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-data text-[13px] text-text-primary">{booking.code}</span>
                  <StatusBadge status={booking.status} />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
                  <div>
                    <div className="text-text-secondary">Paid</div>
                    <div className="font-data text-text-primary">{formatUSD(booking.amount)}</div>
                  </div>
                  <div>
                    <div className="text-text-secondary">Refunded</div>
                    <div className="font-data text-text-primary">{formatUSD(summary.approvedTotal)}</div>
                  </div>
                  <div>
                    <div className="text-text-secondary">Refundable</div>
                    <div className="font-data text-text-primary">{formatUSD(summary.refundable)}</div>
                  </div>
                </div>
                {hasPendingRequest && (
                  <p className="mt-2 text-[12px] text-warning">
                    A refund request for this booking is already waiting for a decision.
                  </p>
                )}
                {!hasPendingRequest && summary.refundable <= 0 && (
                  <p className="mt-2 text-[12px] text-warning">This booking has already been fully refunded.</p>
                )}
              </>
            )}
          </div>
        )}

        <FormField
          label="Amount (USD)"
          error={errors.amount}
          hint={summary && !errors.amount ? `Up to ${formatUSD(summary.refundable)}` : undefined}
        >
          <Input
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            max={summary?.refundable}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </FormField>

        <FormField label="Reason" error={errors.reason}>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} />
        </FormField>

        {formError && (
          <p role="alert" className="text-[13px] text-danger">
            {formError}
          </p>
        )}
      </div>
    </ConfirmDialog>
  );
}

// `bookingId` fixes the booking (booking page, AI copilot); without it the
// dialog starts with a booking search (Refunds page).
export function RequestRefundDialog({ open, bookingId, ...props }) {
  return open ? <RefundForm fixedBookingId={bookingId} {...props} /> : null;
}
