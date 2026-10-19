import clsx from "clsx";
import { CalendarPlus, Compass, CornerDownLeft, LifeBuoy, Moon, Search, Sun, Undo2, UserRound } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ServiceIcon } from "../components/ServiceIcon";
import { Avatar } from "../components/ui/Avatar";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useTour } from "../context/TourContext";
import { useSearch } from "../hooks/useSearch";
import { formatDateTime, humanize } from "../lib/formatters";
import { can, canViewPath } from "../lib/permissions";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { NAV_GROUPS } from "./navigation";

const ACCOUNT_PAGE = { to: "/account", label: "Account settings", icon: UserRound };
const SEARCH_DELAY_MS = 250;

function IconTile({ icon: Icon }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-btn border border-border bg-canvas text-text-secondary"
    >
      <Icon size={15} />
    </span>
  );
}

function Kbd({ children }) {
  return (
    <kbd className="font-data inline-flex h-5 min-w-5 items-center justify-center rounded-btn border border-border bg-canvas px-1 text-[10px] text-text-secondary">
      {children}
    </kbd>
  );
}

// Pages and actions the signed-in role can use, before anything is typed.
function buildCommands({ user, theme, toggleTheme, startTour, go }) {
  const pages = [...NAV_GROUPS.flatMap((group) => group.items), ACCOUNT_PAGE]
    .filter((page) => canViewPath(user, page.to))
    .map((page) => ({
      id: `page:${page.to}`,
      title: page.label,
      leading: <IconTile icon={page.icon} />,
      run: go(page.to),
    }));

  const actions = [];
  if (can(user, "booking.create")) {
    actions.push({ id: "action:new-booking", title: "New booking", leading: <IconTile icon={CalendarPlus} />, run: go("/bookings?new=1") });
  }
  if (can(user, "refund.request")) {
    actions.push({ id: "action:new-refund", title: "Request a refund", leading: <IconTile icon={Undo2} />, run: go("/refunds?new=1") });
  }
  actions.push(
    {
      id: "action:theme",
      title: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
      leading: <IconTile icon={theme === "dark" ? Sun : Moon} />,
      run: toggleTheme,
    },
    { id: "action:tour", title: "Take the tour", leading: <IconTile icon={Compass} />, run: startTour }
  );

  return { pages, actions };
}

// Search results as palette rows; each opens the exact record.
function buildRecordSections(data, go) {
  if (!data) return [];
  const sections = [];
  if (data.bookings.length) {
    sections.push({
      id: "bookings",
      label: "Bookings",
      items: data.bookings.map((booking) => ({
        id: `booking:${booking._id}`,
        title: (
          <>
            <span className="font-data">{booking.code}</span>
            <span className="text-text-secondary"> · </span>
            {booking.service}
          </>
        ),
        subtitle: <span className="font-data">{formatDateTime(booking.scheduledAt)}</span>,
        leading: <ServiceIcon service={booking.service} size={32} />,
        trailing: <StatusBadge status={booking.status} />,
        run: go(`/bookings/${booking._id}`),
      })),
    });
  }
  if (data.customers.length) {
    sections.push({
      id: "customers",
      label: "Customers",
      items: data.customers.map((customer) => ({
        id: `customer:${customer._id}`,
        title: customer.name,
        subtitle: (
          <>
            <span className="font-data">{customer.phone}</span>
            {customer.area ? ` · ${customer.area}` : ""}
          </>
        ),
        leading: <Avatar name={customer.name} size={32} />,
        run: go(`/customers?customer=${customer._id}`),
      })),
    });
  }
  if (data.tickets.length) {
    sections.push({
      id: "tickets",
      label: "Support tickets",
      items: data.tickets.map((ticket) => ({
        id: `ticket:${ticket._id}`,
        title: ticket.subject,
        subtitle: (
          <>
            <span className="font-data">{ticket.code}</span> · {humanize(ticket.priority)} priority
          </>
        ),
        leading: <IconTile icon={LifeBuoy} />,
        trailing: <StatusBadge status={ticket.status} />,
        run: go(`/support?ticket=${ticket._id}`),
      })),
    });
  }
  return sections;
}

// Ctrl/Cmd + K from anywhere: jump to a page, run an action, or find a
// booking, customer or ticket by ID, name or phone.
export function CommandPalette({ onClose }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { startTour } = useTour();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const listboxId = useId();

  const trimmed = query.trim();
  const debounced = useDebouncedValue(trimmed, SEARCH_DELAY_MS);
  const search = useSearch(debounced);
  const isSettling = trimmed !== "" && (debounced !== trimmed || search.isFetching);

  const sections = useMemo(() => {
    const go = (path) => () => navigate(path);
    const { pages, actions } = buildCommands({ user, theme, toggleTheme, startTour, go });
    if (!trimmed) {
      return [
        { id: "pages", label: "Go to", items: pages },
        { id: "actions", label: "Actions", items: actions },
      ];
    }
    const needle = trimmed.toLowerCase();
    const commands = [...pages, ...actions].filter((item) => item.title.toLowerCase().includes(needle));
    return [
      ...(commands.length ? [{ id: "commands", label: "Pages and actions", items: commands }] : []),
      ...buildRecordSections(search.data, go),
    ];
  }, [trimmed, search.data, user, theme, toggleTheme, startTour, navigate]);

  // One running index across every section, for the keyboard.
  const { indexedSections, items } = useMemo(() => {
    const result = [];
    let offset = 0;
    for (const section of sections) {
      const start = offset;
      result.push({ ...section, items: section.items.map((item, i) => ({ ...item, index: start + i })) });
      offset += section.items.length;
    }
    return { indexedSections: result, items: result.flatMap((section) => section.items) };
  }, [sections]);
  const active = Math.min(activeIndex, items.length - 1);

  // Focus the input on open; give focus back to whatever had it on close.
  useEffect(() => {
    const previous = document.activeElement;
    inputRef.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function select(item) {
    onClose();
    item.run();
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      // Stopped so a drawer underneath doesn't close too.
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!items.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((active + step + items.length) % items.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (items[active]) select(items[active]);
    } else if (event.key === "Tab") {
      // The palette is modal; focus stays in the search box.
      event.preventDefault();
    }
  }

  const showsStaleResults = isSettling && Boolean(search.data);
  const isEmpty = trimmed !== "" && !isSettling && items.length === 0;

  return createPortal(
    <div
      className="animate-overlay-enter fixed inset-0 z-[65] flex items-start justify-center bg-black/50 px-4 pt-[12vh] backdrop-blur-[2px] short:pt-[6vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search and commands"
        className="animate-dialog-enter flex w-full max-w-[600px] flex-col overflow-hidden rounded-card border border-border bg-surface shadow-pop"
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search size={16} className="shrink-0 text-text-secondary" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label="Search bookings, customers, tickets and pages"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={items.length ? `${listboxId}-${active}` : undefined}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search bookings, customers, tickets or pages…"
            className="h-12 min-w-0 flex-1 bg-transparent text-[14px] text-text-primary placeholder:text-text-secondary focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-btn text-text-secondary hover:text-text-primary"
            aria-label="Close search"
          >
            <Kbd>Esc</Kbd>
          </button>
        </div>

        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Results"
          className={clsx(
            "max-h-[min(380px,calc(100dvh-14rem))] overflow-y-auto p-2 transition-opacity",
            showsStaleResults && "opacity-60"
          )}
        >
          {indexedSections.map((section) => (
            <div key={section.id} role="group" aria-labelledby={`${listboxId}-${section.id}`} className="pb-1">
              <div
                id={`${listboxId}-${section.id}`}
                className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-text-secondary"
              >
                {section.label}
              </div>
              {section.items.map((item) => {
                const isActive = item.index === active;
                return (
                  <div
                    key={item.id}
                    id={`${listboxId}-${item.index}`}
                    data-index={item.index}
                    role="option"
                    aria-selected={isActive}
                    onMouseMove={() => {
                      if (item.index !== active) setActiveIndex(item.index);
                    }}
                    onClick={() => select(item)}
                    className={clsx(
                      "flex cursor-pointer items-center gap-3 rounded-btn px-2 py-1.5 transition-colors",
                      isActive ? "bg-accent/10" : "hover:bg-canvas"
                    )}
                  >
                    {item.leading}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] text-text-primary">{item.title}</div>
                      {item.subtitle && <div className="truncate text-[12px] text-text-secondary">{item.subtitle}</div>}
                    </div>
                    {item.trailing}
                    <CornerDownLeft
                      size={14}
                      aria-hidden="true"
                      className={clsx("shrink-0 text-text-secondary", isActive ? "opacity-100" : "opacity-0")}
                    />
                  </div>
                );
              })}
            </div>
          ))}

          {isSettling && !search.data && (
            <p className="px-2 py-3 text-[13px] text-text-secondary">Searching…</p>
          )}
          {isEmpty && (
            <div className="px-2 py-8 text-center">
              <p className="text-[13px] font-medium text-text-primary">
                No results for “<span className="break-all">{trimmed}</span>”
              </p>
              <p className="mt-1 text-[12px] text-text-secondary">
                Try a booking or ticket number such as <span className="font-data">4853</span>, a customer&apos;s name
                or a phone number.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-text-secondary">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            <span className="ml-1">to move</span>
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Enter</Kbd>
            <span className="ml-1">to open</span>
          </span>
          <span className="ml-auto hidden items-center gap-1 sm:flex">
            <Kbd>Esc</Kbd>
            <span className="ml-1">to close</span>
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
