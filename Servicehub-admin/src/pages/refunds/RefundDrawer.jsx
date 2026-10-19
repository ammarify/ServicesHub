import clsx from "clsx";
import { ChevronRight, CircleCheck, CircleX, Clock3, Send } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ServiceIcon } from "../../components/ServiceIcon";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Drawer } from "../../components/ui/Drawer";
import { FormField } from "../../components/ui/FormField";
import { QueryError } from "../../components/ui/QueryError";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Textarea } from "../../components/ui/Textarea";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useDecideRefund, useRefund } from "../../hooks/useRefunds";
import { errorMessage } from "../../lib/api";
import { formatDateTime, formatUSD, relativeTime } from "../../lib/formatters";
import { can } from "../../lib/permissions";

function RefundDrawerSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

// How much of what the customer paid this request would return.
function ShareOfBooking({ amount, paid }) {
  const percent = paid > 0 ? Math.min(100, Math.round((amount / paid) * 100)) : 0;
  return (
    <div className="mt-3">
      <div className="h-1.5 overflow-hidden rounded-full bg-border" aria-hidden="true">
        <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-1.5 text-[12px] text-text-secondary">
        <span className="font-data">{percent}%</span> of the <span className="font-data">{formatUSD(paid)}</span> paid
      </div>
    </div>
  );
}

// Who asked, and who decided (or that it's still waiting).
function RefundHistory({ refund }) {
  const isPending = refund.status === "pending";
  const steps = [
    {
      key: "requested",
      icon: Send,
      tone: "bg-accent/10 text-accent",
      title: `Requested by ${refund.requestedBy?.name ?? "Unknown"}`,
      at: refund.createdAt,
      person: refund.requestedBy?.name,
    },
    isPending
      ? { key: "waiting", icon: Clock3, tone: "bg-warning/10 text-warning", title: "Waiting for a decision" }
      : {
          key: "decided",
          icon: refund.status === "approved" ? CircleCheck : CircleX,
          tone: refund.status === "approved" ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
          title: `${refund.status === "approved" ? "Approved" : "Rejected"} by ${refund.decidedBy?.name ?? "Unknown"}`,
          at: refund.decidedAt,
          note: refund.decisionNote,
          person: refund.decidedBy?.name,
        },
  ];

  return (
    <div>
      <div className="mb-3 text-[13px] font-semibold text-text-primary">History</div>
      <ol className="flex flex-col">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <li key={step.key} className={clsx("relative flex gap-3", !isLast && "pb-4")}>
              {!isLast && <span aria-hidden="true" className="absolute bottom-0 left-[13px] top-8 w-px bg-border" />}
              <span className={clsx("relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full", step.tone)} aria-hidden="true">
                <step.icon size={14} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-center gap-2">
                  {step.person && <Avatar name={step.person} size={20} />}
                  <span className="text-[13px] font-medium text-text-primary">{step.title}</span>
                </div>
                {step.at && (
                  <div className="font-data mt-0.5 text-[12px] text-text-secondary">
                    {formatDateTime(step.at)} · {relativeTime(step.at)}
                  </div>
                )}
                {step.note && (
                  <p className="mt-1.5 rounded-card bg-canvas px-3 py-2 text-[12px] leading-relaxed text-text-primary">{step.note}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function RefundDrawer({ refundId, open, onClose, onDecided }) {
  const { user } = useAuth();
  const toast = useToast();
  const [confirmAction, setConfirmAction] = useState(null);
  const [note, setNote] = useState("");
  const [decisionError, setDecisionError] = useState("");

  const { data: refund, isLoading, isError, error, refetch } = useRefund(refundId);
  const decideMutation = useDecideRefund();
  const notFound = error?.response?.status === 404;

  const canDecide = can(user, "refund.approve");

  function openConfirm(action) {
    setNote("");
    setDecisionError("");
    setConfirmAction(action);
  }

  function handleConfirm() {
    if (!refund) return;
    const decision = confirmAction === "approve" ? "approved" : "rejected";
    setDecisionError("");
    decideMutation.mutate(
      { id: refund._id, decision, note: note.trim() || undefined },
      {
        onSuccess: (updated) => {
          setConfirmAction(null);
          toast.success(`Refund ${updated.code} ${decision}.`);
          onDecided?.(updated._id);
        },
        onError: (err) => setDecisionError(errorMessage(err, "Couldn't record this decision.")),
      }
    );
  }

  return (
    <>
      <Drawer open={open} onClose={onClose} title="Refund request">
        {isError ? (
          <QueryError
            message={notFound ? "This refund request doesn't exist." : "Couldn't load this refund."}
            onRetry={notFound ? undefined : refetch}
          />
        ) : isLoading || !refund ? (
          <RefundDrawerSkeleton />
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-data text-[15px] font-semibold text-text-primary">{refund.code}</span>
                <StatusBadge status={refund.status} />
              </div>
              <div className="font-data mt-1 text-[18px] font-semibold text-text-primary">{formatUSD(refund.amount)}</div>
              {refund.booking && <ShareOfBooking amount={refund.amount} paid={refund.booking.amount} />}
            </div>

            <div>
              <div className="text-[12px] text-text-secondary">Reason</div>
              <p className="mt-1 border-l-2 border-border pl-3 text-[13px] leading-relaxed text-text-primary">{refund.reason}</p>
            </div>

            {refund.booking && (
              <Link
                to={`/bookings/${refund.booking._id}`}
                className="group flex items-center gap-3 rounded-card border border-border p-3 transition-colors hover:bg-canvas"
              >
                <ServiceIcon service={refund.booking.service} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-data text-[13px] text-accent">{refund.booking.code}</span>
                    <StatusBadge status={refund.booking.status} />
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-text-secondary">
                    {refund.booking.service} · {refund.booking.customer?.name ?? "Unknown"}
                  </div>
                </div>
                <ChevronRight size={16} className="shrink-0 text-text-secondary transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            )}

            <RefundHistory refund={refund} />

            <div>
              <div className="mb-2 text-[13px] font-semibold text-text-primary">Decision</div>
              {refund.status !== "pending" ? (
                <p className="text-[13px] text-text-secondary">
                  This request has already been {refund.status}
                  {refund.decidedBy ? ` by ${refund.decidedBy.name}` : ""}.
                </p>
              ) : canDecide ? (
                <div className="flex gap-2">
                  <Button variant="primary" onClick={() => openConfirm("approve")}>
                    Approve refund
                  </Button>
                  <Button variant="ghost" tone="danger" onClick={() => openConfirm("reject")}>
                    Reject
                  </Button>
                </div>
              ) : (
                <div className="rounded-card border border-border px-3 py-2.5 text-[13px] text-text-secondary">
                  Approval requires a Manager or Finance role.
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        title={
          refund
            ? `${confirmAction === "approve" ? "Approve" : "Reject"} ${formatUSD(refund.amount)} refund ${refund.code}?`
            : ""
        }
        icon={confirmAction === "approve" ? CircleCheck : CircleX}
        tone={confirmAction === "approve" ? "default" : "danger"}
        onSubmit={handleConfirm}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              tone={confirmAction === "reject" ? "danger" : "default"}
              disabled={decideMutation.isPending}
            >
              {decideMutation.isPending ? "Saving…" : confirmAction === "approve" ? "Approve refund" : "Reject refund"}
            </Button>
          </>
        }
      >
        {refund && (
          <div className="flex flex-col gap-3 text-left">
            {decisionError && (
              <p role="alert" className="rounded-card border border-danger/30 bg-danger/5 px-3 py-2 text-danger">
                {decisionError}
              </p>
            )}
            <p>
              {confirmAction === "approve"
                ? "The customer is refunded and the requester is notified. Decisions can't be changed later."
                : "No money is returned and the requester is notified. Decisions can't be changed later."}
            </p>
            <FormField label="Note (optional)" hint="Visible to everyone who opens this refund.">
              <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={500} />
            </FormField>
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}
