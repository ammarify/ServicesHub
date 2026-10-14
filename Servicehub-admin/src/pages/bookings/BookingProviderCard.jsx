import { Card } from "../../components/ui/Card";
import { DetailField } from "../../components/ui/DetailField";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatusBadge } from "../../components/ui/StatusBadge";

export function BookingProviderCard({ provider, isLoading }) {
  return (
    <Card>
      <div className="text-[15px] font-semibold text-text-primary">Provider</div>

      <div className="mt-4 flex flex-col gap-3">
        {isLoading ? (
          <>
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-28" />
          </>
        ) : provider ? (
          <>
            <DetailField label="Name">{provider.name}</DetailField>
            <DetailField label="Rating" mono>
              {provider.rating.toFixed(1)}
            </DetailField>
            <DetailField label="Service">{provider.services?.join(", ")}</DetailField>
            <div>
              <div className="text-[12px] text-text-secondary">Availability</div>
              <div className="mt-0.5">
                <StatusBadge status={provider.isAvailable ? "available" : "off_duty"} />
              </div>
            </div>
          </>
        ) : (
          <p className="text-[13px] text-text-secondary">No provider assigned.</p>
        )}
      </div>
    </Card>
  );
}
