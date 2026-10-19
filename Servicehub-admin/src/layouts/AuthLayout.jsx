import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { AuthBrandPanel } from "./AuthBrandPanel";

// Brand panel on the left, the form on the right. Below md only the form
// shows, full width.
//
// The page always fits the window: the brand panel scales its preview to the
// height it has, and the form column is centred. Only on a screen too short
// for the form itself (a phone held sideways) does that column scroll, never
// the page.
export function AuthLayout({ children }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <AuthBrandPanel />

      <div className="relative flex h-full w-full flex-col overflow-y-auto border-border bg-surface px-6 sm:px-10 md:w-[460px] md:shrink-0 md:border-l md:px-12 xl:w-[520px]">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          className="absolute right-6 top-6 flex h-8 w-8 items-center justify-center rounded-btn text-text-secondary transition-colors hover:bg-canvas hover:text-text-primary sm:right-10 md:right-12 short:top-4"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div className="mx-auto my-auto w-full max-w-[360px] py-12 short:py-7 shorter:py-5">{children}</div>
      </div>
    </div>
  );
}
