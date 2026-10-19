import clsx from "clsx";
import { Search } from "lucide-react";
import { Input } from "../../components/ui/Input";
import { Toolbar } from "../../components/ui/Toolbar";
import { useAppConfig } from "../../hooks/useConfig";
import { STATUS_OPTIONS } from "./useBookingsList";

const STATUS_LABELS = {
  all: "All",
  pending: "Pending",
  assigned: "Assigned",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function BookingsToolbar({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  serviceFilter,
  setServiceFilter,
  actions,
}) {
  const { services } = useAppConfig();

  return (
    <Toolbar className="justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by ID or customer..."
            aria-label="Search bookings"
            className="w-56 pl-8"
          />
        </div>

        <div className="inline-flex flex-wrap rounded-btn border border-border bg-canvas p-0.5" role="group" aria-label="Filter by status">
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              aria-pressed={statusFilter === status}
              className={clsx(
                "rounded-btn px-2.5 py-1 text-[13px] transition-colors",
                statusFilter === status
                  ? "bg-surface text-text-primary shadow-card"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>

        <select
          value={serviceFilter}
          onChange={(event) => setServiceFilter(event.target.value)}
          aria-label="Filter by service"
          className="h-9 rounded-card border border-border bg-surface px-3 text-[13px] text-text-primary"
        >
          <option value="all">All Services</option>
          {services.map((service) => (
            <option key={service} value={service}>
              {service}
            </option>
          ))}
        </select>
      </div>

      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </Toolbar>
  );
}
