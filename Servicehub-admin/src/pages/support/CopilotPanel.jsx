import { ChevronLeft, ChevronRight, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { RequestRefundDialog } from "../../components/refunds/RequestRefundDialog";
import { Button } from "../../components/ui/Button";
import { QueryError } from "../../components/ui/QueryError";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useAppConfig } from "../../hooks/useConfig";
import { useAnalyzeTicket, useUpdateTicketPriority } from "../../hooks/useTickets";
import { errorMessage } from "../../lib/api";
import { formatUSD, relativeTime } from "../../lib/formatters";
import { can } from "../../lib/permissions";
import { ReassignProviderDialog } from "../bookings/ReassignProviderDialog";

const ACTION_LABELS = {
  request_refund: "Request refund",
  reassign_provider: "Reassign provider",
  escalate: "Escalate to high priority",
};

const OPEN_BOOKING_STATUSES = ["pending", "assigned"];

function SectionLabel({ children }) {
  return <div className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{children}</div>;
}

export function CopilotPanel({ ticket, onInsertReply, collapsible = false, isCollapsed = false, onToggleCollapse }) {
  const { user } = useAuth();
  const toast = useToast();
  const { aiEnabled } = useAppConfig();
  const [openDialog, setOpenDialog] = useState(null);

  const analyzeMutation = useAnalyzeTicket(ticket._id);
  const priorityMutation = useUpdateTicketPriority(ticket._id);

  const analysis = ticket.aiAnalysis;
  const isLoading = analyzeMutation.isPending;
  const isError = analyzeMutation.isError && !isLoading;
  // A rejected API key or model needs an administrator, not another try.
  const canRetry = analyzeMutation.error?.response?.data?.code !== "AI_MISCONFIGURED";
  const isEscalated = ticket.priority === "high";
  const booking = ticket.booking;

  // Only offer what this person can actually do, for this booking right now
  // (the API would refuse the rest).
  function isActionAvailable(action) {
    if (action === "request_refund") return can(user, "refund.request");
    if (action === "reassign_provider") {
      return can(user, "booking.reassign") && booking && OPEN_BOOKING_STATUSES.includes(booking.status);
    }
    if (action === "escalate") return can(user, "ticket.resolve");
    return false;
  }

  function handleAction(action) {
    if (action === "reassign_provider") setOpenDialog("reassign");
    if (action === "request_refund") setOpenDialog("refund");
    if (action === "escalate") {
      priorityMutation.mutate("high", {
        onSuccess: () => toast.success(`${ticket.code} escalated to high priority.`),
        onError: (error) => toast.error(errorMessage(error)),
      });
    }
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

  const visibleActions = (analysis?.suggestedActions ?? []).filter(
    (action) => action !== "no_action" && isActionAvailable(action)
  );
  const refundPercent = analysis?.refundEligibility?.percent ?? 0;
  const bookingAmount = booking?.amount ?? 0;
  const suggestedRefundAmount = Math.round(((bookingAmount * refundPercent) / 100) * 100) / 100;
  const guardrails = analysis?.guardrails ?? [];

  return (
    <div className="flex h-full w-full shrink-0 flex-col border-l border-border bg-surface min-[1100px]:w-80">
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
        {!aiEnabled ? (
          <div className="rounded-card border border-dashed border-border p-4 text-center">
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent" aria-hidden="true">
              <Sparkles size={18} />
            </span>
            <p className="mt-3 text-[13px] font-medium text-text-primary">Copilot isn't set up yet</p>
            <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">
              The AI Copilot isn't configured on this server. Ask an administrator to add a Groq API key (
              <span className="font-data">GROQ_API_KEY</span>) to enable ticket analysis.
            </p>
          </div>
        ) : (
          <>
            <Button variant="secondary" className="w-full justify-center" onClick={() => analyzeMutation.mutate()} disabled={isLoading}>
              {isLoading ? "Analyzing…" : analysis ? "Re-analyze" : "Analyze"}
            </Button>

            {analysis && !isLoading && (
              <p className="mt-2 text-center text-[11px] text-text-secondary">
                Last analyzed <span className="font-data">{relativeTime(analysis.analyzedAt)}</span>
              </p>
            )}
          </>
        )}

        {isLoading && (
          <div className="mt-5 flex flex-col gap-5" aria-busy="true">
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
            message={errorMessage(analyzeMutation.error, "Analysis failed. Please try again.")}
            onRetry={canRetry ? () => analyzeMutation.mutate() : undefined}
          />
        )}

        {analysis && !isLoading && !isError && (
          <div className="mt-5 flex flex-col gap-5">
            <section>
              <SectionLabel>Summary</SectionLabel>
              <p className="mt-1.5 text-[13px] leading-relaxed text-text-primary">{analysis.summary}</p>
            </section>

            <section>
              <SectionLabel>Sentiment</SectionLabel>
              <div className="mt-1.5">
                <StatusBadge status={analysis.sentiment} />
              </div>
            </section>

            <section>
              <SectionLabel>Refund Eligibility</SectionLabel>
              <p className="mt-1.5 text-[13px] font-medium text-text-primary">
                {analysis.refundEligibility.eligible ? (
                  <>
                    Eligible — <span className="font-data">{analysis.refundEligibility.percent}%</span>
                    {bookingAmount > 0 && (
                      <span className="font-data text-text-secondary"> ({formatUSD(suggestedRefundAmount)})</span>
                    )}
                  </>
                ) : (
                  "Not eligible"
                )}
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-text-secondary">{analysis.refundEligibility.reason}</p>
              {guardrails.length > 0 && (
                <div className="mt-2 rounded-card border border-border bg-canvas px-3 py-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                    <ShieldCheck size={12} className="text-success" />
                    Adjusted by policy checks
                  </div>
                  <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4 text-[12px] leading-relaxed text-text-secondary">
                    {guardrails.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section>
              <SectionLabel>Suggested Reply</SectionLabel>
              <blockquote className="mt-1.5 whitespace-pre-wrap rounded-card border border-border bg-canvas px-3 py-2 text-[13px] leading-relaxed text-text-primary">
                {analysis.suggestedReply}
              </blockquote>
              {can(user, "ticket.reply") && (
                <Button
                  variant="ghost"
                  className="mt-2 w-full justify-center"
                  onClick={() => onInsertReply(analysis.suggestedReply)}
                >
                  Insert into composer
                </Button>
              )}
            </section>

            {visibleActions.length > 0 && (
              <section>
                <SectionLabel>Actions</SectionLabel>
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

        {aiEnabled && !analysis && !isLoading && !isError && (
          <div className="mt-5">
            <p className="text-[13px] leading-relaxed text-text-secondary">Analyze this ticket to get:</p>
            <ul className="mt-2 flex flex-col gap-2">
              {[
                "A short summary and how the customer feels",
                "Refund eligibility checked against your policy",
                "A reply you can edit before sending",
              ].map((text) => (
                <li key={text} className="flex items-start gap-2 text-[13px] text-text-primary">
                  <Sparkles size={13} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border px-4 py-3">
        <p className="text-[11px] text-text-secondary">Copilot suggestions require agent review.</p>
      </div>

      {booking && (
        <>
          <ReassignProviderDialog open={openDialog === "reassign"} booking={booking} onClose={() => setOpenDialog(null)} />
          <RequestRefundDialog
            open={openDialog === "refund"}
            bookingId={booking._id}
            defaultAmount={suggestedRefundAmount || undefined}
            defaultReason={analysis?.refundEligibility?.reason ?? ""}
            onClose={() => setOpenDialog(null)}
          />
        </>
      )}
    </div>
  );
}
