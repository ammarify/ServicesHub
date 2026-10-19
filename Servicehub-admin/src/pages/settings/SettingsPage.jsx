import { UserCheck, UserPlus, Users, UserX } from "lucide-react";
import { useState } from "react";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { DataTable } from "../../components/ui/DataTable";
import { EmptyState } from "../../components/ui/EmptyState";
import { QueryError } from "../../components/ui/QueryError";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";
import {
  useResendInvite,
  useRevokeInvite,
  useTeam,
  useUpdateTeamMemberRole,
  useUpdateTeamMemberStatus,
} from "../../hooks/useTeam";
import { errorMessage } from "../../lib/api";
import { formatDate, relativeTime } from "../../lib/formatters";
import { can } from "../../lib/permissions";
import { AddMemberDialog, InviteLinkPanel } from "./AddMemberDialog";
import { ChangeRoleDialog } from "./ChangeRoleDialog";
import { roleLabel } from "./roles";
import { TeamRowMenu } from "./TeamRowMenu";

function memberStatus(member) {
  if (member.status === "disabled") return "disabled";
  return member.invitePending ? "invited" : "active";
}

export function SettingsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: members = [], isLoading, isError, refetch } = useTeam();
  const canManageTeam = can(user, "team.manage");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [roleDialogMember, setRoleDialogMember] = useState(null);
  const [resentInvite, setResentInvite] = useState(null);

  const updateRoleMutation = useUpdateTeamMemberRole();
  const updateStatusMutation = useUpdateTeamMemberStatus();
  const resendInviteMutation = useResendInvite();
  const revokeInviteMutation = useRevokeInvite();

  function handleChangeRole(id, role) {
    updateRoleMutation.mutate(
      { id, role },
      {
        onSuccess: (member) => {
          toast.success(`${member.name} is now ${roleLabel(member.role)}.`);
          setRoleDialogMember(null);
        },
      }
    );
  }

  async function handleToggleStatus(member) {
    const disabling = member.status === "active";
    const done = await confirm({
      title: disabling ? `Disable ${member.name}?` : `Enable ${member.name}?`,
      description: disabling
        ? "They're signed out everywhere right away and can't sign in until you enable the account again."
        : "They can sign in again with their existing password.",
      confirmLabel: disabling ? "Disable account" : "Enable account",
      pendingLabel: "Saving…",
      tone: disabling ? "danger" : "default",
      icon: disabling ? UserX : UserCheck,
      onConfirm: () => updateStatusMutation.mutateAsync({ id: member._id, status: disabling ? "disabled" : "active" }),
    });
    if (done) {
      toast.success(disabling ? `${member.name} was disabled and signed out everywhere.` : `${member.name} can sign in again.`);
    }
  }

  async function handleRevokeInvite(member) {
    const done = await confirm({
      title: `Withdraw ${member.name}'s invitation?`,
      description: "Their invitation link stops working and the unused account is deleted. You can invite them again later.",
      confirmLabel: "Withdraw invitation",
      pendingLabel: "Withdrawing…",
      tone: "danger",
      onConfirm: () => revokeInviteMutation.mutateAsync(member._id),
    });
    if (done) toast.success(`Invitation for ${member.name} withdrawn.`);
  }

  function handleResendInvite(member) {
    resendInviteMutation.mutate(member._id, {
      onSuccess: (result) => setResentInvite(result),
      onError: (error) => toast.error(errorMessage(error, "Couldn't create a new invitation.")),
    });
  }

  const columns = [
    {
      key: "name",
      label: "Name",
      render: (member) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={member.name} size={26} />
          <span className="font-medium text-text-primary">{member.name}</span>
          {member._id === user.id && (
            <span className="rounded-btn bg-accent/10 px-1.5 py-0.5 text-[11px] font-medium text-accent">You</span>
          )}
        </div>
      ),
    },
    {
      key: "email",
      label: "Email",
      render: (member) => <span className="font-data text-text-secondary">{member.email}</span>,
    },
    {
      key: "role",
      label: "Role",
      render: (member) => (
        <span className="inline-block whitespace-nowrap rounded-btn border border-border px-2 py-0.5 text-[12px] text-text-secondary">
          {roleLabel(member.role)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (member) => <StatusBadge status={memberStatus(member)} />,
    },
    {
      key: "lastLoginAt",
      label: "Last sign-in",
      render: (member) =>
        member.lastLoginAt ? (
          <span className="font-data">{relativeTime(member.lastLoginAt)}</span>
        ) : (
          <span className="font-data text-text-secondary">Never</span>
        ),
    },
    {
      key: "createdAt",
      label: "Joined",
      render: (member) => <span className="font-data">{formatDate(member.createdAt)}</span>,
    },
    ...(canManageTeam
      ? [
          {
            key: "actions",
            label: "",
            align: "right",
            render: (member) =>
              member._id === user.id ? null : (
                <div className="flex justify-end">
                  <TeamRowMenu
                    member={member}
                    onChangeRole={() => setRoleDialogMember(member)}
                    onToggleStatus={() => handleToggleStatus(member)}
                    onResendInvite={() => handleResendInvite(member)}
                    onRevokeInvite={() => handleRevokeInvite(member)}
                  />
                </div>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-text-primary">Team</h2>
          <p className="mt-0.5 text-[13px] text-text-secondary">
            <span className="font-data">{members.length}</span> members. Changing a role or disabling an account signs
            that person out immediately.
          </p>
        </div>
        {canManageTeam && (
          <Button variant="primary" className="shrink-0 self-start sm:self-auto" onClick={() => setIsAddOpen(true)}>
            <UserPlus size={14} />
            Add member
          </Button>
        )}
      </div>

      <Card padded={false}>
        {isError ? (
          <QueryError message="Couldn't load the team." onRetry={refetch} />
        ) : (
          <DataTable
            columns={columns}
            data={members}
            getRowKey={(member) => member._id}
            isLoading={isLoading}
            skeletonRowCount={6}
            emptyState={<EmptyState icon={Users} title="No team members yet" description="Invite your team to give each person the access their job needs." />}
          />
        )}
      </Card>

      {canManageTeam && (
        <>
          <AddMemberDialog open={isAddOpen} onClose={() => setIsAddOpen(false)} />

          <ChangeRoleDialog
            member={roleDialogMember}
            onClose={() => {
              setRoleDialogMember(null);
              updateRoleMutation.reset();
            }}
            onSubmit={handleChangeRole}
            isSubmitting={updateRoleMutation.isPending}
            error={updateRoleMutation.isError ? errorMessage(updateRoleMutation.error) : ""}
          />

          <ConfirmDialog
            open={resentInvite !== null}
            onClose={() => setResentInvite(null)}
            title="New invitation link"
            footer={
              <Button variant="primary" onClick={() => setResentInvite(null)}>
                Done
              </Button>
            }
          >
            {resentInvite && <InviteLinkPanel invite={resentInvite} />}
          </ConfirmDialog>
        </>
      )}
    </div>
  );
}
