import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { QueryError } from "../../components/ui/QueryError";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useReassignBooking } from "../../hooks/useBookings";
import { useProviders } from "../../hooks/useProviders";
import { useAnalyzeTicket, useUpdateTicketPriority } from "../../hooks/useTickets";
import { relativeTime } from "../../lib/formatters";
import { ReassignProviderDialog } from "../bookings/ReassignProviderDialog";
import { RequestRefundDialog } from "./RequestRefundDialog";

const ACTION_LABELS = {
  request_refund: "Request refund",
  reassign_provider: "Reassign provider",
  escalate: "Escalate to high priority",
};

export function CopilotPanel({
  ticket,
  onInsertReply,
  collapsible = false,
  isCollapsed = false,
  onToggleCollapse,
}) {
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [reassignError, setReassignError] = useState("");

  const analyzeMutation = useAnalyzeTicket(ticket._id);
  const priorityMutation = useUpdateTicketPriority(ticket._id);
  const reassignMutation = useReassignBooking(ticket.booking?._id);
  const providersQuery = useProviders({ service: ticket.booking?.service, limit: 50 });

  const reassignCandidates = useMemo(() => {
    const allProviders = providersQuery.data?.items ?? [];
    return allProviders.filter((p) => p._id !== ticket.booking?.provider?._id);
  }, [providersQuery.data, ticket.booking?.provider?._id]);

  const analysis = ticket.aiAnalysis;
  const isLoading = analyzeMutation.isPending;
  const isError = analyzeMutation.isError && !isLoading;
  const isEscalated = ticket.priority === "high";

  function handleAnalyze() {
    analyzeMutation.mutate();
  }

  function handleAction(action) {
    if (action === "reassign_provider") setIsReassignOpen(true);
    if (action === "request_refund") setIsRefundOpen(true);
    if (action === "escalate") priorityMutation.mutate("high");
  }

  function handleReassign(providerId) {
    setReassignError("");
    reassignMutation.mutate(providerId, {
      onSuccess: () => setIsReassignOpen(false),
      onError: (error) => setReassignError(error.response?.data?.message ?? "Couldn't reassign this booking."),
    });
  }

  if (collapsible && isCollapsed) {
    return (
      <div className="flex h-full w-11 shrink-0 flex-col items-center border-l border-border bg-surface py-4">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Expand copilot panel"
          className="flex h-7 w-7 items-center justify-center rounded-btn text-text-secondary hover:bg-canvas"
        >
          <ChevronLeft size={16} />
        </button>
        <Sparkles size={16} className="mt-4 text-text-secondary" />
      </div>
    );
  }

  const visibleActions = analysis?.suggestedActions.filter((a) => a !== "no_action") ?? [];
  const refundPercent = analysis?.refundEligibility.percent ?? 0;
  const bookingAmount = ticket.booking?.amount ?? 0;
  const suggestedRefundAmount = Math.round((bookingAmount * refundPercent) / 100);

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          <Sparkles size={13} className="text-accent" />
          <span className="font-data text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
            AI Copilot
          </span>
        </div>
        {collapsible && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse copilot panel"
            className="flex h-7 w-7 items-center justify-center rounded-btn text-text-secondary hover:bg-canvas"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <Button
          variant="secondary"
          className="w-full justify-center"
          onClick={handleAnalyze}
          disabled={isLoading}
        >
          {isLoading ? "Analyzing…" : analysis ? "Re-analyze" : "Analyze"}
        </Button>

        {analysis && !isLoading && (
          <p className="mt-2 text-center text-[11px] text-text-secondary">
            Last analyzed <span className="font-data">{relativeTime(analysis.analyzedAt)}</span>
          </p>
        )}

        {isLoading && (
          <div className="mt-5 flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-full" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        )}

        {isError && (
          <QueryError
            className="mt-5"
            message={analyzeMutation.error?.response?.data?.message ?? "Analysis failed. Please try again."}
            onRetry={handleAnalyze}
          />
        )}

        {analysis && !isLoading && !isError && (
          <div className="mt-5 flex flex-col gap-5">
            <section>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                Summary
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-text-primary">{analysis.summary}</p>
            </section>

            <section>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                Sentiment
              </div>
              <div className="mt-1.5">
                <StatusBadge status={analysis.sentiment} />
              </div>
            </section>

            <section>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                Refund Eligibility
              </div>
              <p className="mt-1.5 text-[13px] font-medium text-text-primary">
                {analysis.refundEligibility.eligible
                  ? `Eligible — ${analysis.refundEligibility.percent}%`
                  : "Not eligible"}
              </p>
              <p className="font-data mt-0.5 text-[11px] text-text-secondary">
                {analysis.refundEligibility.reason}
              </p>
            </section>

            <section>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                Suggested Reply
              </div>
              <blockquote className="mt-1.5 rounded-card border border-border bg-canvas px-3 py-2 text-[13px] leading-relaxed text-text-primary">
                {analysis.suggestedReply}
              </blockquote>
              <Button
                variant="ghost"
                className="mt-2 w-full justify-center"
                onClick={() => onInsertReply(analysis.suggestedReply)}
              >
                Insert into composer
              </Button>
            </section>

            {visibleActions.length > 0 && (
              <section>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                  Actions
                </div>
                <div className="mt-1.5 flex flex-col gap-2">
                  {visibleActions.map((action) => (
                    <Button
                      key={action}
                      variant="secondary"
                      className="w-full justify-center"
                      disabled={action === "escalate" && (isEscalated || priorityMutation.isPending)}
                      onClick={() => handleAction(action)}
                    >
                      {action === "escalate" && isEscalated ? "Already high priority" : ACTION_LABELS[action]}
                    </Button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {!analysis && !isLoading && !isError && (
          <p className="mt-5 text-[13px] leading-relaxed text-text-secondary">
            Run analysis to see a sentiment read, refund recommendation, and a suggested reply for
            this ticket.
          </p>
        )}
      </div>

      <div className="shrink-0 border-t border-border px-4 py-3">
        <p className="text-[11px] text-text-secondary">Copilot suggestions require agent review.</p>
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

      {ticket.booking && (
        <RequestRefundDialog
          open={isRefundOpen}
          onClose={() => setIsRefundOpen(false)}
          bookingId={ticket.booking._id}
          maxAmount={bookingAmount}
          defaultAmount={suggestedRefundAmount}
          defaultReason={analysis?.refundEligibility.reason ?? ""}
        />
      )}
    </div>
  );
}
