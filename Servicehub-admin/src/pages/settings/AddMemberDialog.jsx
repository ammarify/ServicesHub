import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { FormField } from "../../components/ui/FormField";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useToast } from "../../context/ToastContext";
import { useCreateTeamMember } from "../../hooks/useTeam";
import { errorMessage, fieldErrors } from "../../lib/api";
import { ROLE_OPTIONS, roleLabel } from "./roles";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Shows the invitation link with a copy button. Used after adding a member
// and after resending an invite.
export function InviteLinkPanel({ invite }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(invite.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 text-left">
      <p>
        {invite.emailSent ? (
          <>
            We emailed an invitation to <span className="font-data text-text-primary">{invite.member.email}</span>.
            You can also share this link directly:
          </>
        ) : (
          <>
            Email delivery isn't set up on this server, so share this link with{" "}
            <span className="font-medium text-text-primary">{invite.member.name}</span> yourself:
          </>
        )}
      </p>
      <div className="flex items-center gap-2">
        <Input readOnly value={invite.inviteUrl} aria-label="Invitation link" className="font-data text-[12px]" onFocus={(event) => event.target.select()} />
        <Button variant="secondary" onClick={copy} aria-label="Copy invitation link">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="text-[12px]">The link works once and expires in 7 days.</p>
    </div>
  );
}

function AddMemberForm({ onClose }) {
  const [form, setForm] = useState({ name: "", email: "", role: "support_agent" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [invite, setInvite] = useState(null);
  const toast = useToast();
  const mutation = useCreateTeamMember();

  function update(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  function handleSubmit() {
    const nextErrors = {};
    if (form.name.trim().length < 2) nextErrors.name = "Enter their full name";
    if (!EMAIL_PATTERN.test(form.email.trim())) nextErrors.email = "Enter a valid email address";
    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length > 0) return;

    mutation.mutate(
      { name: form.name.trim(), email: form.email.trim(), role: form.role },
      {
        onSuccess: (result) => {
          setInvite(result);
          toast.success(`${result.member.name} added as ${roleLabel(result.member.role)}.`);
        },
        onError: (error) => {
          const apiErrors = fieldErrors(error);
          if (Object.keys(apiErrors).length > 0) setErrors(apiErrors);
          else setFormError(errorMessage(error));
        },
      }
    );
  }

  if (invite) {
    return (
      <ConfirmDialog
        open
        onClose={onClose}
        title={`${invite.member.name} was added`}
        footer={
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        }
      >
        <InviteLinkPanel invite={invite} />
      </ConfirmDialog>
    );
  }

  const selectedRole = ROLE_OPTIONS.find((option) => option.value === form.role);

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title="Add team member"
      description="They'll get a link to choose their own password. Google sign-in works with the same email."
      onSubmit={handleSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Adding…" : "Add and invite"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-left">
        <FormField label="Full name" error={errors.name}>
          <Input value={form.name} onChange={update("name")} autoComplete="off" />
        </FormField>
        <FormField label="Work email" error={errors.email}>
          <Input type="email" value={form.email} onChange={update("email")} autoComplete="off" placeholder="name@servihub.com" />
        </FormField>
        <FormField label="Role" hint={selectedRole?.description} error={errors.role}>
          <Select value={form.role} onChange={update("role")}>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FormField>
        {formError && (
          <p role="alert" className="text-[13px] text-danger">
            {formError}
          </p>
        )}
      </div>
    </ConfirmDialog>
  );
}

export function AddMemberDialog({ open, onClose }) {
  return open ? <AddMemberForm onClose={onClose} /> : null;
}
