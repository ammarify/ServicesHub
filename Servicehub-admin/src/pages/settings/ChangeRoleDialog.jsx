import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { FormField } from "../../components/ui/FormField";
import { Select } from "../../components/ui/Select";
import { ROLE_OPTIONS } from "./roles";

function ChangeRoleForm({ member, onClose, onSubmit, isSubmitting, error }) {
  const [role, setRole] = useState(member.role);

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title="Change role"
      onSubmit={() => onSubmit(member._id, role)}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting || role === member.role}>
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-left">
        <p>
          Update the role for <span className="font-medium text-text-primary">{member.name}</span>. They'll be signed
          out and see their new permissions the next time they sign in.
        </p>
        <FormField label="Role" hint={ROLE_OPTIONS.find((option) => option.value === role)?.description}>
          <Select value={role} onChange={(event) => setRole(event.target.value)}>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FormField>
        {error && (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>
    </ConfirmDialog>
  );
}

export function ChangeRoleDialog({ member, ...props }) {
  return member ? <ChangeRoleForm member={member} {...props} /> : null;
}
