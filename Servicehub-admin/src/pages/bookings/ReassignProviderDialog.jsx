import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { StatusBadge } from "../../components/ui/StatusBadge";

export function ReassignProviderDialog({ open, onClose, candidates, onSelect, isSubmitting, error }) {
  return (
    <ConfirmDialog open={open} onClose={onClose} title="Reassign provider">
      {error && <p className="mb-3 text-[13px] text-danger">{error}</p>}
      {candidates.length === 0 ? (
        <p>No other providers offer this service right now.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {candidates.map((provider) => (
            <div
              key={provider._id}
              className="flex items-center justify-between gap-3 rounded-btn border border-border px-3 py-2"
            >
              <div>
                <div className="text-[13px] font-medium text-text-primary">{provider.name}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[12px] text-text-secondary">
                  <span className="font-data">{provider.rating.toFixed(1)}</span>
                  <StatusBadge status={provider.isAvailable ? "available" : "off_duty"} />
                </div>
              </div>
              <Button
                variant="secondary"
                disabled={isSubmitting}
                onClick={() => onSelect(provider._id)}
              >
                Select
              </Button>
            </div>
          ))}
        </div>
      )}
    </ConfirmDialog>
  );
}
