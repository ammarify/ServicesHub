import clsx from "clsx";
import { Search } from "lucide-react";
import { Input } from "../../components/ui/Input";
import { Toolbar } from "../../components/ui/Toolbar";
import { useAppConfig } from "../../hooks/useConfig";

export function ProvidersToolbar({
  search,
  setSearch,
  serviceFilter,
  setServiceFilter,
  availableOnly,
  toggleAvailableOnly,
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
            placeholder="Search by name..."
            aria-label="Search providers"
            className="w-56 pl-8"
          />
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

      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </Toolbar>
  );
}
