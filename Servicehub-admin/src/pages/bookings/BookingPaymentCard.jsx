import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { formatUSD } from "../../lib/formatters";

export function BookingPaymentCard({ booking, isLoading }) {
  return (
    <Card>
      <div className="text-[15px] font-semibold text-text-primary">Payment</div>

      <div className="mt-4 flex flex-col gap-3">
        {isLoading ? (
          <>
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-40" />
          </>
        ) : (
          <>
            <div className="font-data text-[18px] font-semibold text-text-primary">
              {formatUSD(booking.amount)}
            </div>
            <div className="text-[13px] text-text-secondary">{booking.service}</div>
            <div className="text-[13px] text-text-secondary">{booking.address}</div>
          </>
        )}
      </div>
    </Card>
  );
}
