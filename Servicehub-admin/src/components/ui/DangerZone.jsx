import { Trash2 } from "lucide-react";
import { Button } from "./Button";

// The last section of a profile: one destructive action, with the reason it's
// unavailable when the record can't be removed.
export function DangerZone({ title, description, actionLabel, onAction, disabled, disabledReason, isPending }) {
  return (
    <section aria-label={title} className="rounded-card border border-danger/25 p-4">
      <div className="text-[13px] font-semibold text-text-primary">{title}</div>
      <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">{disabled ? disabledReason : description}</p>
      <Button variant="secondary" tone="danger" className="mt-3" onClick={onAction} disabled={disabled || isPending}>
        <Trash2 size={14} />
        {actionLabel}
      </Button>
    </section>
  );
}
