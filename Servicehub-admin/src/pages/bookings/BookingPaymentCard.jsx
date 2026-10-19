import { MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatUSD, relativeTime } from "../../lib/formatters";

// How much of the booking has gone back to the customer: refunded, waiting
// for a decision, and what could still be refunded.
function RefundBreakdown({ amount, summary }) {
  const share = (value) => `${amount > 0 ? Math.min(100, (value / amount) * 100) : 0}%`;
  const rows = [
    { key: "refunded", label: "Refunded", value: summary.approvedTotal, dot: "bg-success" },
    { key: "pending", label: "Waiting for a decision", value: summary.pendingTotal, dot: "bg-warning" },
    { key: "refundable", label: "Still refundable", value: summary.refundable, dot: "bg-border" },
  ];

  return (
    <div className="rounded-card border border-border p-3">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-border" aria-hidden="true">
        <span className="h-full bg-success" style={{ width: share(summary.approvedTotal) }} />
        <span className="h-full bg-warning" style={{ width: share(summary.pendingTotal) }} />
      </div>
      <dl className="mt-3 flex flex-col gap-1.5 text-[12px]">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center gap-2">
            <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${row.dot}`} />
            <dt className="text-text-secondary">{row.label}</dt>
            <dd className="font-data ml-auto text-text-primary">{formatUSD(row.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function BookingPaymentCard({ booking, isLoading }) {
  const summary = booking?.refundSummary;
  const refunds = booking?.refunds ?? [];
  const hasRefunds = summary && (summary.approvedTotal > 0 || summary.pendingTotal > 0);

  return (
    <Card>
      <h2 className="text-[15px] font-semibold text-text-primary">Payment</h2>

      <div className="mt-4 flex flex-col gap-3">
        {isLoading ? (
          <>
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-3 w-40" />
          </>
        ) : (
          <>
            <div>
              <div className="font-data text-[18px] font-semibold text-text-primary">{formatUSD(booking.amount)}</div>
              <div className="mt-1 flex items-start gap-1.5 text-[12px] text-text-secondary">
                <MapPin size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{booking.address}</span>
              </div>
            </div>

            {hasRefunds && <RefundBreakdown amount={booking.amount} summary={summary} />}

            {refunds.length > 0 && (
              <div>
                <div className="mb-1 text-[12px] text-text-secondary">Refund requests</div>
                <div className="flex flex-col">
                  {refunds.map((refund) => (
                    <Link
                      key={refund._id}
                      to={`/refunds?refund=${refund._id}`}
                      className="-mx-2 flex items-center gap-2 rounded-btn px-2 py-2 text-[13px] transition-colors hover:bg-canvas"
                    >
                      <span className="font-data w-12 shrink-0 text-text-secondary">{refund.code}</span>
                      <span className="font-data flex-1 text-text-primary">{formatUSD(refund.amount)}</span>
                      <StatusBadge status={refund.status} />
                      <span className="font-data w-14 shrink-0 text-right text-[11px] text-text-secondary">
                        {relativeTime(refund.createdAt)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
