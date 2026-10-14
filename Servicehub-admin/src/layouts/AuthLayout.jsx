import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { AuthBrandPanel } from "./AuthBrandPanel";

export function AuthLayout({ children }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex min-h-screen bg-canvas">
      <div className="relative flex w-full flex-col justify-center px-6 py-12 sm:px-10 md:w-[440px] md:shrink-0 md:px-12">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          className="absolute right-6 top-6 flex h-8 w-8 items-center justify-center rounded-btn text-text-secondary transition-colors hover:bg-surface hover:text-text-primary sm:right-10 md:right-12"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div className="mx-auto w-full max-w-[360px]">{children}</div>
      </div>

      <AuthBrandPanel />
    </div>
  );
}
