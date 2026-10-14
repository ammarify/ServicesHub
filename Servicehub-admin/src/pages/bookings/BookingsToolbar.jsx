import clsx from "clsx";
import { Search } from "lucide-react";
import { Input } from "../../components/ui/Input";
import { Toolbar } from "../../components/ui/Toolbar";
import { SERVICE_OPTIONS, STATUS_OPTIONS } from "./useBookingsList";

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
  totalCount,
}) {
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
            className="w-56 pl-8"
          />
        </div>

        <div className="inline-flex rounded-btn border border-border bg-canvas p-0.5">
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
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
          className="h-9 rounded-card border border-border bg-surface px-3 text-[13px] text-text-primary"
        >
          {SERVICE_OPTIONS.map((service) => (
            <option key={service} value={service}>
              {service === "all" ? "All Services" : service}
            </option>
          ))}
        </select>
      </div>

      <div className="text-[13px] text-text-secondary">
        <span className="font-data text-text-primary">{totalCount}</span> bookings
      </div>
    </Toolbar>
  );
}
