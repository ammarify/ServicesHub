import { Check, Star, UserRoundSearch } from "lucide-react";
import { useState } from "react";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { QueryError } from "../../components/ui/QueryError";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatNumber } from "../../lib/formatters";
import { ProviderDrawer } from "./ProviderDrawer";
import { ProvidersToolbar } from "./ProvidersToolbar";
import { useProvidersList } from "./useProvidersList";

function ServicesCell({ services }) {
  const visible = services.slice(0, 2);
  const remaining = services.length - visible.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((service) => (
        <span
          key={service}
          className="rounded-btn border border-border px-2 py-0.5 text-[12px] text-text-secondary"
        >
          {service}
        </span>
      ))}
      {remaining > 0 && <span className="text-[12px] text-text-secondary">+{remaining}</span>}
    </div>
  );
}

const COLUMNS = [
  {
    key: "name",
    label: "Name",
    render: (provider) => (
      <div className="flex items-center gap-2.5">
        <Avatar name={provider.name} size={24} />
        <span className="text-text-primary">{provider.name}</span>
      </div>
    ),
  },
  {
    key: "services",
    label: "Services",
    render: (provider) => <ServicesCell services={provider.services} />,
  },
  { key: "area", label: "Area" },
  {
    key: "rating",
    label: "Rating",
    render: (provider) => (
      <span className="font-data inline-flex items-center gap-1">
        <Star size={12} className="shrink-0 text-text-secondary" />
        {provider.rating.toFixed(1)}
      </span>
    ),
  },
  {
    key: "jobsCompleted",
    label: "Jobs",
    render: (provider) => <span className="font-data">{formatNumber(provider.jobsCompleted)}</span>,
  },
  {
    key: "verified",
    label: "Verified",
    render: (provider) =>
      provider.verified ? (
        <Check size={14} className="text-success" />
      ) : (
        <span className="text-text-secondary">—</span>
      ),
  },
  {
    key: "isAvailable",
    label: "Availability",
    render: (provider) => <StatusBadge status={provider.isAvailable ? "available" : "off_duty"} />,
  },
];

export function ProvidersPage() {
  const list = useProvidersList();
  const [selectedProviderId, setSelectedProviderId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  function handleRowClick(provider) {
    setSelectedProviderId(provider._id);
    setIsDrawerOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <ProvidersToolbar {...list} />

      <Card padded={false}>
        {list.isError ? (
          <QueryError message="Couldn't load providers." onRetry={list.refetch} />
        ) : (
          <DataTable
            columns={COLUMNS}
            data={list.items}
            getRowKey={(provider) => provider._id}
            onRowClick={handleRowClick}
            isLoading={list.isLoading}
            skeletonRowCount={6}
            emptyState={
              <div className="flex flex-col items-center gap-3">
                <UserRoundSearch size={28} className="text-text-secondary" />
                <p className="text-[13px] text-text-secondary">No providers match your filters</p>
                <Button variant="ghost" onClick={list.clearFilters}>
                  Clear filters
                </Button>
              </div>
            }
          />
        )}
      </Card>

      <ProviderDrawer
        providerId={selectedProviderId}
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}
