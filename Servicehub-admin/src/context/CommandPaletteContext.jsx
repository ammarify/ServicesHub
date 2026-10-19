import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CommandPalette } from "../layouts/CommandPalette";

const CommandPaletteContext = createContext({ openPalette: () => {} });

// One search-and-commands palette for the signed-in app. Ctrl/Cmd + K opens
// (and closes) it from any page; the sidebar and topbar buttons call
// openPalette().
export function CommandPaletteProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const openPalette = useCallback(() => setIsOpen(true), []);
  const closePalette = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen((open) => !open);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const value = useMemo(() => ({ openPalette }), [openPalette]);

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      {isOpen && <CommandPalette onClose={closePalette} />}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  return useContext(CommandPaletteContext);
}
