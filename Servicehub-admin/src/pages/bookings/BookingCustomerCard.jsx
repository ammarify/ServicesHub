import { MapPin, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar } from "../../components/ui/Avatar";
import { Card } from "../../components/ui/Card";
import { InfoList, InfoRow } from "../../components/ui/InfoRow";
import { Skeleton } from "../../components/ui/Skeleton";

// Uses the customer embedded in the booking response, so every role that
// can open a booking sees who it's for - only the link to the full profile
// depends on customer access.
export function BookingCustomerCard({ customer, isLoading, canOpenProfile }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-text-primary">Customer</h2>
        {!isLoading && customer && canOpenProfile && (
          <Link to={`/customers?customer=${customer._id}`} className="text-[13px] text-accent hover:underline">
            View profile
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
        </div>
      ) : customer ? (
        <>
          <div className="mt-4 flex items-center gap-3">
            <Avatar name={customer.name} size={40} />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-text-primary">{customer.name}</div>
              <div className="truncate text-[12px] text-text-secondary">{customer.area}</div>
            </div>
          </div>
          <InfoList className="mt-3">
            <InfoRow icon={Phone} label="Phone" mono>
              {customer.phone}
            </InfoRow>
            <InfoRow icon={MapPin} label="Area">
              {customer.area}
            </InfoRow>
          </InfoList>
        </>
      ) : (
        <p className="mt-4 text-[13px] text-text-secondary">Customer record not found.</p>
      )}
    </Card>
  );
}
