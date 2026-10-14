import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";

const ROLE_OPTIONS = ["super_admin", "manager", "support_agent", "finance"];

export function ChangeRoleDialog({ member, open, onClose, onSubmit }) {
  const [role, setRole] = useState("support_agent");

  useEffect(() => {
    if (member) setRole(member.role);
  }, [member]);

  function handleSubmit() {
    if (!member) return;
    onSubmit(member.id, role);
    onClose();
  }

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title="Change role"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            Save
          </Button>
        </>
      }
    >
      {member && (
        <div className="flex flex-col gap-3 text-left">
          <p>
            Update the role for{" "}
            <span className="font-medium text-text-primary">{member.name}</span>.
          </p>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="h-9 w-full rounded-card border border-border bg-surface px-3 text-[13px] text-text-primary"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      )}
    </ConfirmDialog>
  );
}
