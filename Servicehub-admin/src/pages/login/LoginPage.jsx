import { ChevronDown, Eye, EyeOff, Headset, Landmark, Shield, UserCog } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Checkbox } from "../../components/ui/Checkbox";
import { FormField } from "../../components/ui/FormField";
import { Input } from "../../components/ui/Input";
import { Logo } from "../../components/ui/Logo";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useAppConfig } from "../../hooks/useConfig";
import { AuthLayout } from "../../layouts/AuthLayout";
import { errorMessage, fieldErrors as extractFieldErrors } from "../../lib/api";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

// How many times to poll for the Google Identity Services script (loaded
// via a plain <script async defer> in index.html, so it isn't guaranteed
// ready the instant this component mounts) before giving up.
const GOOGLE_SCRIPT_MAX_ATTEMPTS = 40;
const GOOGLE_SCRIPT_POLL_MS = 150;
const GOOGLE_BUTTON_WIDTH = "360";

const DEMO_ACCOUNTS = [
  { role: "super_admin", label: "Super Admin", description: "Full access", icon: Shield },
  { role: "manager", label: "Manager", description: "Ops and support", icon: UserCog },
  { role: "support_agent", label: "Support Agent", description: "Live chats", icon: Headset },
  { role: "finance", label: "Finance", description: "Refund approvals", icon: Landmark },
];

function useAfterLoginRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    const from = location.state?.from;
    navigate(typeof from === "string" && from.startsWith("/") ? from : "/dashboard", { replace: true });
  }, [navigate, location.state]);
}

export function LoginPage() {
  useDocumentTitle("Sign in");
  const { login, googleLogin, demoLogin, sessionNotice, clearSessionNotice } = useAuth();
  const { theme } = useTheme();
  const config = useAppConfig();
  const goToApp = useAfterLoginRedirect();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoLoadingRole, setDemoLoadingRole] = useState(null);
  const [showDemoAccess, setShowDemoAccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const googleButtonRef = useRef(null);
  // Read inside the Google callback, which is registered once.
  const keepLoggedInRef = useRef(keepLoggedIn);
  useEffect(() => {
    keepLoggedInRef.current = keepLoggedIn;
  }, [keepLoggedIn]);

  const googleClientId = config.googleClientId;

  const handleGoogleCredential = useCallback(
    async ({ credential }) => {
      setFormError("");
      try {
        await googleLogin(credential, keepLoggedInRef.current);
        goToApp();
      } catch (error) {
        setFormError(errorMessage(error));
      }
    },
    [googleLogin, goToApp]
  );

  // The GSI script may not have run yet when this component mounts - poll
  // briefly rather than assuming window.google exists. Skipped entirely when
  // the API has no Google client id configured.
  useEffect(() => {
    if (!googleClientId) return undefined;
    let cancelled = false;
    let attempts = 0;

    function tryInit() {
      if (cancelled) return;
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
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
  }, [googleClientId, handleGoogleCredential]);

  // Google renders its own button (an iframe), so re-render it with the
  // matching theme whenever ours changes.
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
    clearSessionNotice();
    setFieldErrors({});
    setFormError("");

    const nextErrors = {};
    if (!email.trim()) nextErrors.email = "Enter your email";
    if (!password) nextErrors.password = "Enter your password";
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim(), password, keepLoggedIn);
      goToApp();
    } catch (error) {
      const errors = extractFieldErrors(error);
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
      } else {
        setFormError(errorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDemoLogin(role) {
    clearSessionNotice();
    setFormError("");
    setDemoLoadingRole(role);
    try {
      await demoLogin(role);
      goToApp();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setDemoLoadingRole(null);
    }
  }

  return (
    <AuthLayout>
      <div className="flex items-center gap-2">
        <Logo size={28} />
        <span className="text-[15px] font-semibold tracking-tight text-text-primary">ServiHub</span>
      </div>

      <h1 className="mt-10 text-[20px] font-semibold text-text-primary short:mt-6 shorter:mt-5">Sign in to ServiHub</h1>
      <p className="mt-1 text-[13px] text-text-secondary">Use your work email and password to continue.</p>

      {sessionNotice && (
        <div role="status" className="mt-5 flex items-start gap-2 rounded-card border border-border bg-surface px-3 py-2.5">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
          <p className="text-[13px] text-text-primary">{sessionNotice}</p>
        </div>
      )}

      {googleClientId && (
        <>
          <div ref={googleButtonRef} className="mt-6 flex min-h-10 w-full items-center justify-center" />

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">OR</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className={googleClientId ? "flex flex-col gap-3" : "mt-6 flex flex-col gap-3 short:mt-4"} noValidate>
        <FormField label="Email" error={fieldErrors.email}>
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@servihub.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>

        <div className="relative">
          <FormField label="Password" error={fieldErrors.password}>
            <Input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pr-10"
            />
          </FormField>
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute right-1 top-[27px] flex h-8 w-8 items-center justify-center rounded-btn text-text-secondary transition-colors hover:text-text-primary"
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <Checkbox
            label="Keep me logged in"
            checked={keepLoggedIn}
            onChange={(event) => setKeepLoggedIn(event.target.checked)}
          />
          <Link to="/forgot-password" className="text-[13px] font-medium text-accent hover:underline">
            Forgot password?
          </Link>
        </div>

        {formError && (
          <p role="alert" className="text-[13px] text-danger">
            {formError}
          </p>
        )}

        <Button type="submit" variant="primary" className="mt-1 w-full justify-center" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {config.demoMode && (
        <div className="mt-6 rounded-card border border-border short:mt-4">
          <button
            type="button"
            onClick={() => setShowDemoAccess((prev) => !prev)}
            aria-expanded={showDemoAccess}
            aria-controls="demo-access"
            className="flex w-full items-center justify-between gap-3 rounded-card px-3.5 py-3 text-left transition-colors hover:bg-canvas"
          >
            <span>
              <span className="block text-[13px] font-medium text-text-primary">Try a demo account</span>
              <span className="block text-[12px] text-text-secondary">Explore ServiHub as any role, no password needed</span>
            </span>
            <ChevronDown
              size={15}
              className={showDemoAccess ? "shrink-0 rotate-180 text-text-secondary transition-transform" : "shrink-0 text-text-secondary transition-transform"}
            />
          </button>

          {showDemoAccess && (
            <div id="demo-access" className="grid grid-cols-1 gap-2 border-t border-border p-3 min-[360px]:grid-cols-2">
              {DEMO_ACCOUNTS.map(({ role, label, description, icon: Icon }) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleDemoLogin(role)}
                  disabled={demoLoadingRole !== null}
                  className="group flex items-start gap-2.5 rounded-card border border-border bg-surface p-2.5 text-left transition-colors hover:border-accent/40 hover:bg-accent/5 disabled:opacity-50 short:py-2"
                >
                  <span className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-btn bg-accent/10 text-accent min-[400px]:flex">
                    <Icon size={14} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-text-primary">
                      {demoLoadingRole === role ? "Signing in…" : label}
                    </span>
                    <span className="block text-[11px] leading-snug text-text-secondary shorter:hidden">{description}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="mt-6 text-[12px] text-text-secondary short:mt-4 shorter:hidden">Internal tool for authorized ServiHub staff.</p>
    </AuthLayout>
  );
}
