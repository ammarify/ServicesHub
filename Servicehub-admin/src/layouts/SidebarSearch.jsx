import { Search } from "lucide-react";
import { useCommandPalette } from "../context/CommandPaletteContext";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

// Looks like a search box; opens the command palette, where searching
// happens (Ctrl/Cmd + K does the same from anywhere).
export function SidebarSearch({ onNavigate }) {
  const { openPalette } = useCommandPalette();

  return (
    <button
      type="button"
      onClick={() => {
        onNavigate?.();
        openPalette();
      }}
      aria-label="Search bookings, customers and tickets"
      aria-keyshortcuts="Control+K Meta+K"
      className="flex h-8 w-full items-center gap-2 rounded-card border border-border bg-canvas px-2.5 text-[13px] text-text-secondary transition-colors hover:border-text-secondary/40 hover:text-text-primary"
    >
      <Search size={14} className="shrink-0" />
      <span className="flex-1 text-left">Search...</span>
      <kbd className="font-data shrink-0 text-[11px]">{isMac ? "⌘K" : "Ctrl K"}</kbd>
    </button>
  );
}
