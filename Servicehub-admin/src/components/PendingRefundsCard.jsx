import { formatUSD, relativeTime } from "../lib/formatters";
import { ListCard, ListRow } from "./dashboard/ListCard";
import { Avatar } from "./ui/Avatar";

export function PendingRefundsCard({ refunds, isLoading }) {
  return (
    <ListCard
      title="Pending refunds"
      subtitle="Waiting for a decision"
      viewAllTo="/refunds"
      isLoading={isLoading}
      isEmpty={refunds.length === 0}
      emptyText="No refunds waiting for a decision."
    >
      {refunds.map((refund) => (
        <ListRow
          key={refund._id}
          to={`/refunds?refund=${refund._id}`}
          leading={<Avatar name={refund.booking?.customer?.name ?? "?"} size={32} />}
          title={refund.booking?.customer?.name ?? "Unknown customer"}
          meta={
            <>
              <span className="font-data">{refund.code}</span> · {refund.reason}
            </>
          }
          trailing={
            <>
              <span className="font-data w-14 text-right font-medium text-text-primary">{formatUSD(refund.amount)}</span>
              <span className="font-data hidden w-14 text-right text-[12px] text-text-secondary sm:inline">
                {relativeTime(refund.createdAt)}
              </span>
            </>
          }
        />
      ))}
    </ListCard>
  );
}
