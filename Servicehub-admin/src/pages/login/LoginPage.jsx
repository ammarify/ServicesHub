import { ChevronDown, Headset, Landmark, Shield, UserCog } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Logo } from "../../components/ui/Logo";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { AuthLayout } from "../../layouts/AuthLayout";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

// How many times to poll for the Google Identity Services script (loaded
// via a plain <script async defer> in index.html, so it isn't guaranteed
// ready the instant this component mounts) before giving up.
const GOOGLE_SCRIPT_MAX_ATTEMPTS = 40;
const GOOGLE_SCRIPT_POLL_MS = 150;
const GOOGLE_BUTTON_WIDTH = "360";

const DEMO_ACCOUNTS = [
  { role: "super_admin", label: "Super Admin", icon: Shield },
  { role: "manager", label: "Manager", icon: UserCog },
  { role: "support_agent", label: "Support Agent", icon: Headset },
  { role: "finance", label: "Finance", icon: Landmark },
];

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export function LoginPage() {
  useDocumentTitle("Sign in");
  const { login, googleLogin, demoLogin } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoLoadingRole, setDemoLoadingRole] = useState(null);
  const [showDemoAccess, setShowDemoAccess] = useState(false);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const googleButtonRef = useRef(null);

  const handleGoogleCredential = useCallback(
    async ({ credential }) => {
      setFormError("");
      try {
        await googleLogin(credential);
        navigate("/dashboard", { replace: true });
      } catch (error) {
        setFormError(error.response?.data?.message ?? GENERIC_ERROR_MESSAGE);
      }
    },
    [googleLogin, navigate],
  );

  // The GSI script (index.html, <script async defer>) may not have run
  // yet by the time this component mounts - poll briefly rather than
  // assuming window.google exists. Initialize once; the render effect
  // below handles re-rendering the button itself on theme changes.
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    function tryInit() {
      if (cancelled) return;
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential,
        });
        setIsGoogleReady(true);
        return;
      }
      if (attempts < GOOGLE_SCRIPT_MAX_ATTEMPTS) {
        attempts += 1;
        setTimeout(tryInit, GOOGLE_SCRIPT_POLL_MS);
      }
    }

    tryInit();
    return () => {
      cancelled = true;
    };
  }, [handleGoogleCredential]);

  // Google renders its own button into this container (an iframe, not
  // styleable CSS) so we don't get automatic light/dark switching for
  // free - re-render with the matching theme whenever ours changes, per
  // Google's branding guidelines rather than a hand-built button.
  useEffect(() => {
    if (!isGoogleReady || !googleButtonRef.current) return;
    googleButtonRef.current.innerHTML = "";
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: theme === "dark" ? "filled_black" : "outline",
      size: "large",
      width: GOOGLE_BUTTON_WIDTH,
    });
  }, [isGoogleReady, theme]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFieldErrors({});
    setFormError("");
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      const data = error.response?.data;
      if (data?.errors) {
        setFieldErrors(data.errors);
      } else {
        setFormError(data?.message ?? GENERIC_ERROR_MESSAGE);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDemoLogin(role) {
    setFormError("");
    setDemoLoadingRole(role);
    try {
      await demoLogin(role);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setFormError(error.response?.data?.message ?? GENERIC_ERROR_MESSAGE);
    } finally {
      setDemoLoadingRole(null);
    }
  }

  return (
    <AuthLayout>
      <div className="flex items-center gap-2">
        <Logo size={28} />
        <span className="text-[15px] font-semibold tracking-tight text-text-primary">
          ServiHub
        </span>
      </div>

      <h1 className="mt-8 text-[20px] font-semibold text-text-primary">Sign in to ServiHub</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Enter your credentials to continue
      </p>

      <div ref={googleButtonRef} className="mt-6 flex min-h-10 w-full items-center justify-center" />

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
          OR
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-[13px] text-text-secondary">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@servihub.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {fieldErrors.email && <p className="mt-1 text-[12px] text-danger">{fieldErrors.email}</p>}
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-[13px] text-text-secondary">
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {fieldErrors.password && (
            <p className="mt-1 text-[12px] text-danger">{fieldErrors.password}</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-[13px] text-text-secondary">
            <input
              type="checkbox"
              checked={keepLoggedIn}
              onChange={(event) => setKeepLoggedIn(event.target.checked)}
              style={{ accentColor: "var(--color-accent)" }}
              className="h-3.5 w-3.5 rounded-sm"
            />
            Keep me logged in
          </label>
          <Link
            to="/forgot-password"
            className="text-[13px] font-medium text-accent hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        {formError && <p className="text-[13px] text-danger">{formError}</p>}

        <Button
          type="submit"
          variant="primary"
          className="mt-1 w-full justify-center"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="mt-6 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => setShowDemoAccess((prev) => !prev)}
          aria-expanded={showDemoAccess}
          className="flex items-center gap-1 text-[12px] text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronDown
            size={13}
            className={showDemoAccess ? "rotate-180 transition-transform" : "transition-transform"}
          />
          {showDemoAccess ? "Hide demo access" : "Show demo access"}
        </button>

        {showDemoAccess && (
          <div className="mt-3 rounded-card border border-border bg-canvas p-3">
            <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
              Demo Access
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map(({ role, label, icon: Icon }) => (
                <Button
                  key={role}
                  type="button"
                  variant="secondary"
                  onClick={() => handleDemoLogin(role)}
                  disabled={demoLoadingRole !== null}
                  className="justify-center"
                >
                  <Icon size={14} />
                  {demoLoadingRole === role ? "Signing in…" : label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="mt-6 text-[12px] text-text-secondary">
        Internal tool — authorized staff only.
      </p>
    </AuthLayout>
  );
}
