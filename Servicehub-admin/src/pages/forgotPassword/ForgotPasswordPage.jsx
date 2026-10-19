import { ArrowLeft, MailCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { FormField } from "../../components/ui/FormField";
import { Input } from "../../components/ui/Input";
import { Logo } from "../../components/ui/Logo";
import { useForgotPassword } from "../../hooks/useAccount";
import { AuthLayout } from "../../layouts/AuthLayout";
import { errorMessage, fieldErrors } from "../../lib/api";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordPage() {
  useDocumentTitle("Forgot password");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const mutation = useForgotPassword();

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setEmailError("Enter a valid email address");
      return;
    }
    setEmailError("");
    mutation.mutate(trimmed, {
      onSuccess: () => setSentTo(trimmed),
      onError: (error) => setEmailError(fieldErrors(error).email ?? ""),
    });
  }

  return (
    <AuthLayout>
      <div className="flex items-center gap-2">
        <Logo size={28} />
        <span className="text-[15px] font-semibold tracking-tight text-text-primary">ServiHub</span>
      </div>

      {sentTo ? (
        <div className="mt-8">
          <span className="flex h-9 w-9 items-center justify-center rounded-btn bg-accent/10 text-accent">
            <MailCheck size={18} />
          </span>
          <h1 className="mt-4 text-[20px] font-semibold text-text-primary">Check your email</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
            If an account exists for <span className="font-data text-text-primary">{sentTo}</span>, we've sent a
            link to reset its password. The link expires in 1 hour.
          </p>
          <Button variant="secondary" className="mt-5" onClick={() => setSentTo("")}>
            Use a different email
          </Button>
        </div>
      ) : (
        <>
          <h1 className="mt-8 text-[20px] font-semibold text-text-primary">Reset your password</h1>
          <p className="mt-1 text-[13px] text-text-secondary">
            Enter the email associated with your account and we'll send you a reset link.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3" noValidate>
            <FormField label="Email" error={emailError}>
              <Input
                type="email"
                autoComplete="email"
                placeholder="you@servihub.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </FormField>

            {mutation.isError && !emailError && (
              <p role="alert" className="text-[13px] text-danger">
                {errorMessage(mutation.error)}
              </p>
            )}

            <Button type="submit" variant="primary" className="mt-1 w-full justify-center" disabled={mutation.isPending}>
              {mutation.isPending ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        </>
      )}

      <Link to="/login" className="mt-6 flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline">
        <ArrowLeft size={14} />
        Back to sign in
      </Link>
    </AuthLayout>
  );
}
