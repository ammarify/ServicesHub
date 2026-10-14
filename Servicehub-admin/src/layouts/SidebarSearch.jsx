import clsx from "clsx";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSearch } from "../hooks/useSearch";
import { useDebouncedValue } from "../lib/useDebouncedValue";

function buildResults(data) {
  if (!data) return [];
  return [
    ...data.bookings.map((b) => ({
      type: "booking",
      key: b._id,
      mono: b.code,
      label: b.service,
      path: `/bookings/${b._id}`,
    })),
    ...data.customers.map((c) => ({
      type: "customer",
      key: c._id,
      mono: c.phone,
      label: c.name,
      path: "/customers",
    })),
    ...data.tickets.map((t) => ({
      type: "ticket",
      key: t._id,
      mono: t.code,
      label: t.subject,
      path: "/support",
    })),
  ];
}

export function SidebarSearch() {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  const debouncedQuery = useDebouncedValue(query, 300);
  const { data, isLoading } = useSearch(debouncedQuery);
  const results = useMemo(() => buildResults(data), [data]);

  useEffect(() => {
    function handleGlobalKeyDown(event) {
      const isMod = event.metaKey || event.ctrlKey;
      if (isMod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function handleSelect(result) {
    navigate(result.path);
    setQuery("");
    setIsOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      handleSelect(results[activeIndex]);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex h-8 items-center gap-2 rounded-card border border-border bg-canvas px-2.5 text-text-secondary focus-within:border-accent">
        <Search size={14} className="shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => query && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search..."
          className="w-full bg-transparent text-[13px] text-text-primary placeholder:text-text-secondary focus:outline-none"
        />
        <span className="shrink-0 text-[11px] text-text-secondary">⌘K</span>
      </div>

      {isOpen && query && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-card border border-border bg-surface p-1 shadow-card">
          {isLoading ? (
            <p className="px-3 py-2.5 text-[13px] text-text-secondary">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2.5 text-[13px] text-text-secondary">No results</p>
          ) : (
            results.map((result, index) => (
              <button
                key={`${result.type}-${result.key}`}
                type="button"
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setActiveIndex(index)}
                className={clsx(
                  "flex w-full items-center gap-2.5 rounded-btn px-2.5 py-2 text-left transition-colors",
                  index === activeIndex ? "bg-accent/10" : "hover:bg-canvas",
                )}
              >
                <span className="font-data w-16 shrink-0 truncate text-[11px] text-text-secondary">
                  {result.mono}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary">
                  {result.label}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
