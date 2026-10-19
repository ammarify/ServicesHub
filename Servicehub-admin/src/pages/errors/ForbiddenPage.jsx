import { ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../context/AuthContext";
import { roleLabel } from "../settings/roles";
import { ErrorState } from "./ErrorState";

export function ForbiddenPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <ErrorState
      icon={ShieldAlert}
      code="Error 403"
      title="Access denied"
      description={`The ${roleLabel(user?.role)} role can't open this page. If your work needs it, ask a Super Admin to change your role in Settings.`}
      actions={
        <Button variant="primary" onClick={() => navigate("/dashboard")}>
          Back to Dashboard
        </Button>
      }
    />
  );
}
