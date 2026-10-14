import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { DetailField } from "../../components/ui/DetailField";
import { Skeleton } from "../../components/ui/Skeleton";
import { formatNumber } from "../../lib/formatters";

export function BookingCustomerCard({ customer, isLoading }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-semibold text-text-primary">Customer</div>
        {!isLoading && customer && (
          <Link to="/customers" className="text-[13px] text-accent hover:underline">
            View
          </Link>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {isLoading ? (
          <>
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-24" />
          </>
        ) : customer ? (
          <>
            <DetailField label="Name">{customer.name}</DetailField>
            <DetailField label="Phone" mono>
              {customer.phone}
            </DetailField>
            <DetailField label="Area">{customer.area}</DetailField>
            <DetailField label="Total Bookings" mono>
              {formatNumber(customer.totalBookings)}
            </DetailField>
          </>
        ) : (
          <p className="text-[13px] text-text-secondary">No customer found.</p>
        )}
      </div>
    </Card>
  );
}
