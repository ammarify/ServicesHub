import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "servihub-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

const ThemeContext = createContext(null);

// "light" or "dark" when the person picked one, otherwise "system". The
// inline script in index.html reads the same key, so there's no flash of
// the wrong theme before React starts.
function readPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function subscribeToSystemTheme(onChange) {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function systemTheme() {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(readPreference);
  // Follows the operating system live while the preference is "system".
  const fromSystem = useSyncExternalStore(subscribeToSystemTheme, systemTheme, () => "light");
  const theme = preference === "system" ? fromSystem : preference;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    try {
      if (preference === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Storage unavailable: the choice still applies until the page reloads.
    }
  }, [preference]);

  // setTheme("light" | "dark" | "system"); toggleTheme flips the visible theme.
  const setTheme = useCallback((next) => setPreference(next), []);
  const toggleTheme = useCallback(() => setPreference(theme === "dark" ? "light" : "dark"), [theme]);

  const value = useMemo(() => ({ theme, preference, setTheme, toggleTheme }), [theme, preference, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
