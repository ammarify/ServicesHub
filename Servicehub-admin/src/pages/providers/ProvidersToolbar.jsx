import clsx from "clsx";
import { Search } from "lucide-react";
import { Input } from "../../components/ui/Input";
import { Toolbar } from "../../components/ui/Toolbar";
import { SERVICE_OPTIONS } from "./useProvidersList";

export function ProvidersToolbar({
  search,
  setSearch,
  serviceFilter,
  setServiceFilter,
  availableOnly,
  toggleAvailableOnly,
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
            placeholder="Search by name..."
            className="w-56 pl-8"
          />
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

        <button
          type="button"
          onClick={toggleAvailableOnly}
          aria-pressed={availableOnly}
          className={clsx(
            "h-9 rounded-card border px-3 text-[13px] transition-colors",
            availableOnly
              ? "border-accent/30 bg-accent/10 text-accent"
              : "border-border bg-surface text-text-secondary hover:text-text-primary",
          )}
        >
          Available only
        </button>
      </div>

      <div className="text-[13px] text-text-secondary">
        <span className="font-data text-text-primary">{totalCount}</span> providers
      </div>
    </Toolbar>
  );
}
