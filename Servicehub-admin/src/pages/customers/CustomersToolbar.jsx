import { Search } from "lucide-react";
import { Input } from "../../components/ui/Input";
import { Toolbar } from "../../components/ui/Toolbar";

export function CustomersToolbar({ search, setSearch, totalCount }) {
  return (
    <Toolbar className="justify-between">
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or phone..."
          className="w-64 pl-8"
        />
      </div>

      <div className="text-[13px] text-text-secondary">
        <span className="font-data text-text-primary">{totalCount}</span> customers
      </div>
    </Toolbar>
  );
}
