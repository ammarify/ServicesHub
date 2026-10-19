import { BadgeCheck, CircleDashed, Phone, Star, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar } from "../../components/ui/Avatar";
import { Card } from "../../components/ui/Card";
import { InfoList, InfoRow } from "../../components/ui/InfoRow";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatusBadge } from "../../components/ui/StatusBadge";

export function BookingProviderCard({ provider, isLoading, canOpenProfile }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-text-primary">Provider</h2>
        {!isLoading && provider && canOpenProfile && (
          <Link to={`/providers?provider=${provider._id}`} className="text-[13px] text-accent hover:underline">
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
      ) : provider ? (
        <>
          <div className="mt-4 flex items-center gap-3">
            <Avatar name={provider.name} size={40} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[13px] font-medium text-text-primary">
                <span className="truncate">{provider.name}</span>
                {provider.verified && <BadgeCheck size={14} className="shrink-0 text-success" aria-label="Verified" />}
              </div>
              <div className="mt-0.5">
                <StatusBadge status={provider.isAvailable ? "available" : "off_duty"} />
              </div>
            </div>
          </div>
          <InfoList className="mt-3">
            <InfoRow icon={Phone} label="Phone" mono>
              {provider.phone}
            </InfoRow>
            <InfoRow icon={Star} label="Rating" mono>
              {provider.rating.toFixed(1)}
            </InfoRow>
            <InfoRow icon={Wrench} label="Services">
              {provider.services?.join(", ")}
            </InfoRow>
          </InfoList>
        </>
      ) : (
        <div className="mt-4 flex items-center gap-3 rounded-card border border-dashed border-border p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas text-text-secondary">
            <CircleDashed size={16} />
          </span>
          <div>
            <div className="text-[13px] font-medium text-text-primary">No provider yet</div>
            <div className="text-[12px] text-text-secondary">Assign one to schedule the visit.</div>
          </div>
        </div>
      )}
    </Card>
  );
}
