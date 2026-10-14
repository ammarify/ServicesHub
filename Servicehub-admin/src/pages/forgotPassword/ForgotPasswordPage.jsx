import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Logo } from "../../components/ui/Logo";
import { AuthLayout } from "../../layouts/AuthLayout";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

export function ForgotPasswordPage() {
  useDocumentTitle("Forgot password");
  const [email, setEmail] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    // TODO: wired in Prompt 3
  }

  return (
    <AuthLayout>
      <div className="flex items-center gap-2">
        <Logo size={28} />
        <span className="text-[15px] font-semibold tracking-tight text-text-primary">
          ServiHub
        </span>
      </div>

      <h1 className="mt-8 text-[20px] font-semibold text-text-primary">Reset your password</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Enter the email associated with your account
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3" noValidate>
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
        </div>

        <Button type="submit" variant="primary" className="mt-1 w-full justify-center">
          Send reset link
        </Button>
      </form>

      <Link
        to="/login"
        className="mt-6 flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline"
      >
        <ArrowLeft size={14} />
        Back to sign in
      </Link>
    </AuthLayout>
  );
}
