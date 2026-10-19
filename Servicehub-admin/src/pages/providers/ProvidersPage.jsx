import { BadgeCheck, Plus, Star, UserRoundSearch } from "lucide-react";
import { useState } from "react";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { EmptyState } from "../../components/ui/EmptyState";
import { Pagination } from "../../components/ui/Pagination";
import { QueryError } from "../../components/ui/QueryError";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { formatNumber } from "../../lib/formatters";
import { can } from "../../lib/permissions";
import { useQueryParamState } from "../../lib/useQueryParamState";
import { ProviderDrawer } from "./ProviderDrawer";
import { ProviderFormDialog } from "./ProviderFormDialog";
import { ProvidersToolbar } from "./ProvidersToolbar";
import { useProvidersList } from "./useProvidersList";

function ServicesCell({ services }) {
  const visible = services.slice(0, 2);
  const remaining = services.length - visible.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((service) => (
        <span key={service} className="rounded-btn border border-border px-2 py-0.5 text-[12px] text-text-secondary">
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
      <span className="flex items-center gap-2.5">
        <Avatar name={provider.name} size={26} />
        <span className="font-medium text-text-primary">{provider.name}</span>
        {provider.verified && <BadgeCheck size={14} className="shrink-0 text-success" aria-label="Verified" />}
      </span>
    ),
  },
  {
    key: "services",
    label: "Services",
    render: (provider) => <ServicesCell services={provider.services} />,
  },
  { key: "area", label: "Area", render: (provider) => <span className="text-text-secondary">{provider.area}</span> },
  {
    key: "rating",
    label: "Rating",
    render: (provider) => (
      <span className="font-data inline-flex items-center gap-1">
        <Star size={12} className="shrink-0 fill-current text-text-secondary" />
        {provider.rating.toFixed(1)}
      </span>
    ),
  },
  {
    key: "jobsCompleted",
    label: "Jobs",
    align: "right",
    render: (provider) => <span className="font-data">{formatNumber(provider.jobsCompleted)}</span>,
  },
  {
    key: "isAvailable",
    label: "Availability",
    render: (provider) => <StatusBadge status={provider.isAvailable ? "available" : "off_duty"} />,
  },
];

export function ProvidersPage() {
  const { user } = useAuth();
  const list = useProvidersList();
  const canManage = can(user, "provider.manage");
  // ?provider=<id> opens the drawer, so profiles can be linked to.
  const [selectedProviderId, setSelectedProviderId] = useQueryParamState("provider");
  // Remembered separately so the drawer keeps its content while sliding out.
  const [drawerProviderId, setDrawerProviderId] = useState(selectedProviderId);
  const [formState, setFormState] = useState(null);

  if (selectedProviderId && selectedProviderId !== drawerProviderId) {
    setDrawerProviderId(selectedProviderId);
  }

  return (
    <div className="flex flex-col gap-4">
      <ProvidersToolbar
        {...list}
        actions={
          canManage && (
            <Button variant="primary" onClick={() => setFormState({ provider: null })}>
              <Plus size={14} />
              Add provider
            </Button>
          )
        }
      />

      <Card padded={false}>
        {list.isError ? (
          <QueryError message="Couldn't load providers." onRetry={list.refetch} />
        ) : (
          <DataTable
            columns={COLUMNS}
            data={list.items}
            getRowKey={(provider) => provider._id}
            onRowClick={(provider) => setSelectedProviderId(provider._id)}
            isLoading={list.isLoading}
            isFetching={list.isFetching}
            skeletonRowCount={list.pageSize}
            emptyState={
              list.hasActiveFilters ? (
                <EmptyState
                  icon={UserRoundSearch}
                  title="No providers match these filters"
                  description="Try another service, or include providers who are off duty."
                  action={
                    <Button variant="secondary" onClick={list.clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={UserRoundSearch}
                  title="No providers yet"
                  description="Add the people who carry out your jobs so bookings can be assigned to them."
                  action={
                    canManage && (
                      <Button variant="primary" onClick={() => setFormState({ provider: null })}>
                        <Plus size={14} />
                        Add provider
                      </Button>
                    )
                  }
                />
              )
            }
            footer={
              <Pagination
                page={list.page}
                pageSize={list.pageSize}
                total={list.totalCount}
                totalPages={list.totalPages}
                onPageChange={list.setPage}
                onPageSizeChange={list.setPageSize}
                label="providers"
              />
            }
          />
        )}
      </Card>

      <ProviderDrawer
        providerId={drawerProviderId}
        open={Boolean(selectedProviderId)}
        onClose={() => setSelectedProviderId(null)}
        canManage={canManage}
        onEdit={(provider) => setFormState({ provider })}
      />

      <ProviderFormDialog
        open={formState !== null}
        provider={formState?.provider}
        onClose={() => setFormState(null)}
        onSaved={(provider) => {
          if (!formState?.provider) setSelectedProviderId(provider._id);
        }}
      />
    </div>
  );
}
