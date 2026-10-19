import { ArrowLeft, CircleCheck, CircleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PasswordStrength } from "../../components/PasswordStrength";
import { Button } from "../../components/ui/Button";
import { FormField } from "../../components/ui/FormField";
import { Input } from "../../components/ui/Input";
import { Logo } from "../../components/ui/Logo";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../context/AuthContext";
import { useResetPassword, useVerifyPasswordToken } from "../../hooks/useAccount";
import { AuthLayout } from "../../layouts/AuthLayout";
import { errorMessage, fieldErrors } from "../../lib/api";
import { validatePassword } from "../../lib/passwordRules";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

const BROKEN_LINK_MESSAGE = "This link is invalid or has expired. Request a new one.";

// Why a link can't be used. A malformed token (cut short when it was copied,
// say) fails the API's request validation before it is looked up; to the
// person it's the same broken link, not a field error.
function linkProblem(error) {
  return fieldErrors(error).token ? BROKEN_LINK_MESSAGE : errorMessage(error);
}

// Serves both "forgot password" links and team invitations: the API tells
// us which one the token is for.
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const verify = useVerifyPasswordToken(token);
  const reset = useResetPassword();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
  const [isDone, setIsDone] = useState(false);

  const isInvite = verify.data?.purpose === "invite";
  useDocumentTitle(isInvite ? "Set up your account" : "Choose a new password");

  const verifyToken = verify.mutate;
  useEffect(() => {
    if (token) verifyToken();
  }, [token, verifyToken]);

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    const passwordProblem = validatePassword(password);
    if (passwordProblem) nextErrors.password = passwordProblem;
    if (confirm !== password) nextErrors.confirm = "Passwords don't match";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    reset.mutate(
      { token, password },
      {
        onSuccess: () => setIsDone(true),
        onError: (error) => setErrors({ password: fieldErrors(error).password ?? "" }),
      }
    );
  }

  async function goToLogin() {
    // Someone else might be signed in on this browser (e.g. an admin
    // testing an invite link); sign them out so the new password is used.
    if (user) await logout();
    navigate("/login", { replace: true });
  }

  let content;
  if (!token || verify.isError) {
    content = (
      <div className="mt-8">
        <span className="flex h-9 w-9 items-center justify-center rounded-btn bg-danger/10 text-danger">
          <CircleAlert size={18} />
        </span>
        <h1 className="mt-4 text-[20px] font-semibold text-text-primary">This link can't be used</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
          {verify.isError
            ? linkProblem(verify.error)
            : "The link is incomplete. Open it again from your email, or request a new one."}
        </p>
        <Link
          to="/forgot-password"
          className="mt-5 inline-flex h-[34px] items-center rounded-btn bg-accent px-3 text-[13px] font-medium text-white hover:brightness-110"
        >
          Request a new link
        </Link>
      </div>
    );
  } else if (!verify.isSuccess) {
    content = (
      <div className="mt-8 flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3 w-64" />
        <Skeleton className="mt-4 h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  } else if (isDone) {
    content = (
      <div className="mt-8">
        <span className="flex h-9 w-9 items-center justify-center rounded-btn bg-success/10 text-success">
          <CircleCheck size={18} />
        </span>
        <h1 className="mt-4 text-[20px] font-semibold text-text-primary">
          {isInvite ? "Your account is ready" : "Password updated"}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
          {isInvite
            ? "You can now sign in with your email and the password you just chose."
            : "You've been signed out of every device. Sign in with your new password."}
        </p>
        <Button variant="primary" className="mt-5" onClick={goToLogin}>
          Go to sign in
        </Button>
      </div>
    );
  } else {
    content = (
      <>
        <h1 className="mt-8 text-[20px] font-semibold text-text-primary">
          {isInvite ? `Welcome, ${verify.data.name}` : "Choose a new password"}
        </h1>
        <p className="mt-1 text-[13px] text-text-secondary">
          {isInvite ? "Choose a password to activate " : "Set a new password for "}
          <span className="font-data text-text-primary">{verify.data.email}</span>.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3" noValidate>
          <div className="flex flex-col gap-2">
            <FormField label="New password" hint="At least 8 characters, with a letter and a number." error={errors.password}>
              <Input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </FormField>
            <PasswordStrength password={password} />
          </div>
          <FormField label="Confirm password" error={errors.confirm}>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </FormField>

          {reset.isError && !errors.password && (
            <p role="alert" className="text-[13px] text-danger">
              {errorMessage(reset.error)}
            </p>
          )}

          <Button type="submit" variant="primary" className="mt-1 w-full justify-center" disabled={reset.isPending}>
            {reset.isPending ? "Saving…" : isInvite ? "Activate account" : "Update password"}
          </Button>
        </form>
      </>
    );
  }

  return (
    <AuthLayout>
      <div className="flex items-center gap-2">
        <Logo size={28} />
        <span className="text-[15px] font-semibold tracking-tight text-text-primary">ServiHub</span>
      </div>

      {content}

      {!isDone && (
        <Link to="/login" className="mt-6 flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline">
          <ArrowLeft size={14} />
          Back to sign in
        </Link>
      )}
    </AuthLayout>
  );
}
