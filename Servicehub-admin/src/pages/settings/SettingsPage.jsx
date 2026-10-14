import { UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { QueryError } from "../../components/ui/QueryError";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { useTeam, useUpdateTeamMemberRole, useUpdateTeamMemberStatus } from "../../hooks/useTeam";
import { formatDate } from "../../lib/formatters";
import { can } from "../../lib/permissions";
import { ChangeRoleDialog } from "./ChangeRoleDialog";
import { TeamRowMenu } from "./TeamRowMenu";

export function SettingsPage() {
  const { user } = useAuth();
  const { data: members = [], isLoading, isError, refetch } = useTeam();
  const canManageTeam = can(user.role, "team.manage");

  const [roleDialogMember, setRoleDialogMember] = useState(null);
  const [actionError, setActionError] = useState("");

  const updateRoleMutation = useUpdateTeamMemberRole();
  const updateStatusMutation = useUpdateTeamMemberStatus();

  function handleChangeRole(id, role) {
    setActionError("");
    updateRoleMutation.mutate(
      { id, role },
      { onError: (error) => setActionError(error.response?.data?.message ?? "Couldn't change that member's role.") }
    );
  }

  function handleToggleStatus(member) {
    setActionError("");
    const status = member.status === "active" ? "disabled" : "active";
    updateStatusMutation.mutate(
      { id: member._id, status },
      { onError: (error) => setActionError(error.response?.data?.message ?? "Couldn't change that member's status.") }
    );
  }

  const columns = [
    {
      key: "name",
      label: "Name",
      render: (member) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={member.name} size={24} />
          <span className="text-text-primary">{member.name}</span>
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
        <span className="font-data inline-block rounded-btn border border-border px-2 py-0.5 text-[12px] lowercase text-text-secondary">
          {member.role}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (member) => <StatusBadge status={member.status} />,
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
                    member={{ ...member, id: member._id }}
                    onChangeRole={() => setRoleDialogMember(member)}
                    onToggleStatus={() => handleToggleStatus(member)}
                  />
                </div>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-text-primary">Team</h2>
        {canManageTeam && (
          <Button variant="primary" disabled title="Adding new members isn't available in this demo yet">
            <UserPlus size={14} />
            Add member
          </Button>
        )}
      </div>

      {actionError && <p className="text-[13px] text-danger">{actionError}</p>}

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
            emptyState={
              <div className="flex flex-col items-center gap-3">
                <Users size={28} className="text-text-secondary" />
                <p className="text-[13px] text-text-secondary">No team members yet</p>
              </div>
            }
          />
        )}
      </Card>

      {canManageTeam && (
        <ChangeRoleDialog
          member={roleDialogMember ? { ...roleDialogMember, id: roleDialogMember._id } : null}
          open={roleDialogMember !== null}
          onClose={() => setRoleDialogMember(null)}
          onSubmit={handleChangeRole}
        />
      )}
    </div>
  );
}
