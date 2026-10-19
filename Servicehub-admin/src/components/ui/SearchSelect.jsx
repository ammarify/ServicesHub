import clsx from "clsx";
import { Search, X } from "lucide-react";
import { forwardRef, useId, useRef, useState } from "react";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

// A search-as-you-type picker for one record (a customer, a booking...).
// `useOptions(query)` is a hook returning { items, isLoading }; it's called
// on every render with the debounced query.
export const SearchSelect = forwardRef(function SearchSelect(
  {
    value,
    onChange,
    useOptions,
    getKey,
    renderOption,
    renderValue,
    placeholder = "Search…",
    emptyText = "No matches",
    id,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedBy,
  },
  ref
) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const debouncedQuery = useDebouncedValue(query, 250);
  const { items, isLoading } = useOptions(debouncedQuery.trim());
  const listboxId = useId();
  const containerRef = useRef(null);

  function select(item) {
    onChange(item);
    setQuery("");
    setIsOpen(false);
  }

  // The list opens on a click, on typing or with ↓, not on focus alone: a
  // dialog that focuses this field first shouldn't open with suggestions
  // covering the rest of its form.
  function handleKeyDown(event) {
    if (event.key === "Escape") {
      if (isOpen) {
        // Close just the suggestions, not the dialog around them.
        event.stopPropagation();
        setIsOpen(false);
      }
      return;
    }
    if (!items.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((prev) => (prev + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
    } else if (event.key === "Enter" && isOpen) {
      event.preventDefault();
      select(items[Math.min(activeIndex, items.length - 1)]);
    }
  }

  if (value) {
    return (
      <div
        className="flex min-h-9 items-center justify-between gap-2 rounded-card border border-border bg-surface px-3 py-1.5"
        aria-describedby={ariaDescribedBy}
      >
        <div className="min-w-0 text-[13px] text-text-primary">{renderValue ? renderValue(value) : renderOption(value)}</div>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Clear selection"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-btn text-text-secondary hover:bg-canvas"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget)) setIsOpen(false);
      }}
    >
      <div
        className={clsx(
          "flex h-9 items-center gap-2 rounded-card border bg-surface px-3 text-text-secondary focus-within:border-accent",
          ariaInvalid ? "border-danger" : "border-border"
        )}
      >
        <Search size={14} className="shrink-0" />
        <input
          ref={ref}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          aria-activedescendant={isOpen && items.length ? `${listboxId}-${activeIndex}` : undefined}
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setIsOpen(true);
          }}
          onClick={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent text-[13px] text-text-primary placeholder:text-text-secondary focus:outline-none"
        />
      </div>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-card border border-border bg-surface p-1 shadow-pop"
        >
          {isLoading && items.length === 0 ? (
            <p className="px-3 py-2 text-[13px] text-text-secondary">Searching…</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-2 text-[13px] text-text-secondary">{emptyText}</p>
          ) : (
            items.map((item, index) => (
              <button
                key={getKey(item)}
                id={`${listboxId}-${index}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(item)}
                onMouseEnter={() => setActiveIndex(index)}
                className={clsx(
                  "flex w-full items-center rounded-btn px-2.5 py-2 text-left text-[13px] transition-colors",
                  index === activeIndex ? "bg-accent/10" : "hover:bg-canvas"
                )}
              >
                {renderOption(item)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
});
