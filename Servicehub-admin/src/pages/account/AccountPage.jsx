import clsx from "clsx";
import { Check, Headset, Landmark, LogOut, Mail, MonitorSmartphone, Moon, Shield, Sun, UserCog } from "lucide-react";
import { useState } from "react";
import { PasswordStrength } from "../../components/PasswordStrength";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { FormField } from "../../components/ui/FormField";
import { InfoList, InfoRow } from "../../components/ui/InfoRow";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useToast } from "../../context/ToastContext";
import { useChangePassword, useUpdateProfile } from "../../hooks/useAccount";
import { errorMessage, fieldErrors } from "../../lib/api";
import { validatePassword } from "../../lib/passwordRules";
import { ROLE_OPTIONS, roleLabel } from "../settings/roles";

const ROLE_ICONS = { super_admin: Shield, manager: UserCog, support_agent: Headset, finance: Landmark };

function CardHeading({ title, description }) {
  return (
    <div>
      <h2 className="text-[15px] font-semibold text-text-primary">{title}</h2>
      {description && <p className="mt-1 text-[13px] text-text-secondary">{description}</p>}
    </div>
  );
}

// Who's signed in, at the top of the page.
function AccountHeader() {
  const { user } = useAuth();
  const RoleIcon = ROLE_ICONS[user.role] ?? Shield;
  const roleDescription = ROLE_OPTIONS.find((option) => option.value === user.role)?.description;

  return (
    <Card className="flex flex-wrap items-center gap-4">
      <Avatar name={user.name} size={56} />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[20px] font-semibold text-text-primary">{user.name}</h2>
        <div className="font-data mt-0.5 truncate text-[12px] text-text-secondary">{user.email}</div>
      </div>
      <div className="flex max-w-full items-center gap-3 rounded-card border border-border px-3 py-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-btn bg-accent/10 text-accent">
          <RoleIcon size={15} />
        </span>
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-text-primary">{roleLabel(user.role)}</div>
          {roleDescription && <div className="truncate text-[12px] text-text-secondary">{roleDescription}</div>}
        </div>
      </div>
    </Card>
  );
}

function ProfileCard() {
  const { user } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [error, setError] = useState("");
  const mutation = useUpdateProfile();

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Name is too short");
      return;
    }
    setError("");
    mutation.mutate(
      { name: trimmed },
      {
        onSuccess: () => toast.success("Your name was updated."),
        onError: (err) => setError(fieldErrors(err).name ?? errorMessage(err)),
      }
    );
  }

  return (
    <Card>
      <CardHeading title="Profile" description="How your name appears to the team and on booking timelines." />
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3" noValidate>
        <FormField label="Display name" error={error}>
          <Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
        </FormField>
        <InfoList>
          <InfoRow icon={Mail} label="Email" mono>
            {user.email}
          </InfoRow>
          <InfoRow icon={Shield} label="Role">
            {roleLabel(user.role)}
          </InfoRow>
        </InfoList>
        <div>
          <Button type="submit" variant="primary" disabled={mutation.isPending || name.trim() === user.name}>
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

const THEME_OPTIONS = [
  { value: "light", label: "Light", description: "Always light", icon: Sun },
  { value: "dark", label: "Dark", description: "Always dark", icon: Moon },
  { value: "system", label: "System", description: "Match this device", icon: MonitorSmartphone },
];

function AppearanceCard() {
  const { preference, setTheme } = useTheme();

  return (
    <Card>
      <CardHeading title="Appearance" description="Saved in this browser." />
      <div role="radiogroup" aria-label="Theme" className="mt-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
        {THEME_OPTIONS.map((option) => {
          const isSelected = preference === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setTheme(option.value)}
              className={clsx(
                "relative flex items-center gap-2.5 rounded-card border p-3 text-left transition-colors min-[420px]:flex-col min-[420px]:items-start",
                isSelected ? "border-accent bg-accent/5" : "border-border hover:bg-canvas"
              )}
            >
              <span
                className={clsx(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-btn",
                  isSelected ? "bg-accent text-white" : "bg-canvas text-text-secondary"
                )}
              >
                <option.icon size={15} />
              </span>
              <span>
                <span className="block text-[13px] font-medium text-text-primary">{option.label}</span>
                <span className="block text-[12px] text-text-secondary">{option.description}</span>
              </span>
              {isSelected && <Check size={14} className="absolute right-3 top-3 text-accent" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function PasswordCard() {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const mutation = useChangePassword();

  function update(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!form.currentPassword) nextErrors.currentPassword = "Enter your current password";
    const problem = validatePassword(form.newPassword);
    if (problem) nextErrors.newPassword = problem;
    else if (form.newPassword === form.currentPassword) nextErrors.newPassword = "Choose a different password";
    if (form.confirm !== form.newPassword) nextErrors.confirm = "Passwords don't match";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    mutation.mutate(
      { currentPassword: form.currentPassword, newPassword: form.newPassword },
      {
        onSuccess: () => {
          setForm({ currentPassword: "", newPassword: "", confirm: "" });
          toast.success("Password changed. Your other devices have been signed out.");
        },
        onError: (err) => {
          const apiErrors = fieldErrors(err);
          if (Object.keys(apiErrors).length > 0) setErrors(apiErrors);
          else toast.error(errorMessage(err));
        },
      }
    );
  }

  return (
    <Card>
      <CardHeading title="Password" description="Changing your password signs you out on every other device." />
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3" noValidate>
        <FormField label="Current password" error={errors.currentPassword}>
          <Input
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={update("currentPassword")}
          />
        </FormField>
        <div className="flex flex-col gap-2">
          <FormField label="New password" hint="At least 8 characters, with a letter and a number." error={errors.newPassword}>
            <Input type="password" autoComplete="new-password" value={form.newPassword} onChange={update("newPassword")} />
          </FormField>
          <PasswordStrength password={form.newPassword} />
        </div>
        <FormField label="Confirm new password" error={errors.confirm}>
          <Input type="password" autoComplete="new-password" value={form.confirm} onChange={update("confirm")} />
        </FormField>
        <div>
          <Button type="submit" variant="primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Updating…" : "Update password"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SessionsCard() {
  const { logoutEverywhere } = useAuth();
  const toast = useToast();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleConfirm() {
    setIsPending(true);
    try {
      await logoutEverywhere();
    } catch (err) {
      toast.error(errorMessage(err));
      setIsPending(false);
      setIsConfirmOpen(false);
    }
  }

  return (
    <Card>
      <CardHeading
        title="Sessions"
        description="Lost a device or signed in on a shared computer? Sign out everywhere, including this browser."
      />
      <Button variant="secondary" tone="danger" className="mt-4" onClick={() => setIsConfirmOpen(true)}>
        <LogOut size={14} />
        Sign out everywhere
      </Button>

      <ConfirmDialog
        open={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title="Sign out everywhere?"
        icon={LogOut}
        tone="danger"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" tone="danger" onClick={handleConfirm} disabled={isPending}>
              {isPending ? "Signing out…" : "Sign out everywhere"}
            </Button>
          </>
        }
      >
        Every active session, on all devices and browsers, will end immediately. You'll need to sign in
        again here too.
      </ConfirmDialog>
    </Card>
  );
}

export function AccountPage() {
  return (
    <div className="flex flex-col gap-4">
      <AccountHeader />
      <div className="grid grid-cols-1 items-start gap-4 min-[900px]:grid-cols-2">
        <div className="flex flex-col gap-4">
          <ProfileCard />
          <AppearanceCard />
        </div>
        <div className="flex flex-col gap-4">
          <PasswordCard />
          <SessionsCard />
        </div>
      </div>
    </div>
  );
}
