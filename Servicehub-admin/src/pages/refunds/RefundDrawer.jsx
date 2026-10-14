import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { DetailField } from "../../components/ui/DetailField";
import { Drawer } from "../../components/ui/Drawer";
import { QueryError } from "../../components/ui/QueryError";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { useDecideRefund, useRefund } from "../../hooks/useRefunds";
import { formatUSD, relativeTime } from "../../lib/formatters";
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

export function RefundDrawer({ refundId, open, onClose, onDecided }) {
  const { user } = useAuth();
  const [confirmAction, setConfirmAction] = useState(null);
  const [decisionError, setDecisionError] = useState("");

  const { data: refund, isLoading, isError, refetch } = useRefund(refundId);
  const decideMutation = useDecideRefund();

  const canDecide = refund ? can(user.role, "refund.approve") : false;

  function handleConfirm() {
    if (!refund) return;
    const decision = confirmAction === "approve" ? "approved" : "rejected";
    setDecisionError("");
    decideMutation.mutate(
      { id: refund._id, decision },
      {
        onSuccess: () => {
          setConfirmAction(null);
          onDecided?.(refund._id);
        },
        onError: (error) => {
          setDecisionError(error.response?.data?.message ?? "Couldn't record this decision.");
        },
      }
    );
  }

  return (
    <>
      <Drawer open={open} onClose={onClose} title="Refund request">
        {isError ? (
          <QueryError message="Couldn't load this refund." onRetry={refetch} />
        ) : isLoading || !refund ? (
          <RefundDrawerSkeleton />
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-data text-[15px] font-semibold text-text-primary">
                  {refund.code}
                </span>
                <StatusBadge status={refund.status} />
              </div>
              <div className="font-data mt-1 text-[18px] font-semibold text-text-primary">
                {formatUSD(refund.amount)}
              </div>
            </div>

            <DetailField label="Reason">{refund.reason}</DetailField>

            {refund.booking && (
              <div className="rounded-card border border-border p-3">
                <div className="text-[12px] text-text-secondary">Linked booking</div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <div>
                    <Link
                      to={`/bookings/${refund.booking._id}`}
                      className="font-data text-[13px] text-accent hover:underline"
                    >
                      {refund.booking.code}
                    </Link>
                    <div className="mt-0.5 text-[13px] text-text-primary">
                      {refund.booking.service}
                    </div>
                  </div>
                  <StatusBadge status={refund.booking.status} />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <DetailField label="Requested By">{refund.requestedBy?.name ?? "Unknown"}</DetailField>
              <DetailField label="Requested" mono>
                {relativeTime(refund.createdAt)}
              </DetailField>
              {refund.decidedBy && (
                <DetailField label="Decided By">{refund.decidedBy.name}</DetailField>
              )}
            </div>

            <div>
              <div className="mb-2 text-[13px] font-semibold text-text-primary">Decision</div>
              {decisionError && <p className="mb-2 text-[13px] text-danger">{decisionError}</p>}
              {refund.status !== "pending" ? (
                <p className="text-[13px] text-text-secondary">
                  This request has already been {refund.status}
                  {refund.decidedBy ? ` by ${refund.decidedBy.name}` : ""}.
                </p>
              ) : canDecide ? (
                <div className="flex gap-2">
                  <Button variant="primary" onClick={() => setConfirmAction("approve")}>
                    Approve refund
                  </Button>
                  <Button variant="ghost" tone="danger" onClick={() => setConfirmAction("reject")}>
                    Reject
                  </Button>
                </div>
              ) : (
                <div className="rounded-card border border-border px-3 py-2.5 text-[13px] text-text-secondary">
                  Approval requires Manager role.
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        title={confirmAction === "approve" ? "Approve refund" : "Reject refund"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmAction === "approve" ? "primary" : "secondary"}
              tone={confirmAction === "reject" ? "danger" : "default"}
              onClick={handleConfirm}
              disabled={decideMutation.isPending}
            >
              {decideMutation.isPending
                ? "Saving…"
                : confirmAction === "approve"
                  ? "Approve"
                  : "Reject"}
            </Button>
          </>
        }
      >
        {refund && (
          <p>
            Are you sure you want to {confirmAction} refund{" "}
            <span className="font-data text-text-primary">{refund.code}</span> for{" "}
            <span className="font-data text-text-primary">{formatUSD(refund.amount)}</span>?
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
