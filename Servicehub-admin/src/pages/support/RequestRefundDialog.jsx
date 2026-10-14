import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Input } from "../../components/ui/Input";
import { useRequestRefund } from "../../hooks/useRefunds";
import { formatUSD } from "../../lib/formatters";

// Opened from the Copilot panel's "Request refund" action, prefilled from
// the AI's percent/reason - editable, since an agent reviewing AI output
// shouldn't be forced to submit it verbatim.
export function RequestRefundDialog({ open, onClose, bookingId, maxAmount, defaultAmount, defaultReason }) {
  const [amount, setAmount] = useState(defaultAmount);
  const [reason, setReason] = useState(defaultReason);
  const [error, setError] = useState("");
  const mutation = useRequestRefund();

  useEffect(() => {
    if (open) {
      setAmount(defaultAmount);
      setReason(defaultReason);
      setError("");
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultAmount, defaultReason]);

  function handleSubmit() {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0 || numericAmount > maxAmount) {
      setError(`Enter an amount between $1 and ${formatUSD(maxAmount)}.`);
      return;
    }
    if (!reason.trim()) {
      setError("Enter a reason.");
      return;
    }
    setError("");
    mutation.mutate(
      { bookingId, amount: numericAmount, reason: reason.trim() },
      {
        onSuccess: () => onClose(),
        onError: (err) => setError(err.response?.data?.message ?? "Couldn't submit the refund request."),
      }
    );
  }

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title="Request refund"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? "Submitting…" : "Submit request"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-left">
        <label className="flex flex-col gap-1 text-[13px] text-text-secondary">
          Amount
          <Input
            type="number"
            min="1"
            max={maxAmount}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-text-secondary">
          Reason
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            className="rounded-card border border-border bg-surface px-3 py-2 text-[13px] text-text-primary"
          />
        </label>
        {error && <p className="text-[13px] text-danger">{error}</p>}
      </div>
    </ConfirmDialog>
  );
}
