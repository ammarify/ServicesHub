import { FileQuestion, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { useCommandPalette } from "../../context/CommandPaletteContext";
import { ErrorState } from "./ErrorState";

export function NotFoundPage() {
  const navigate = useNavigate();
  const { openPalette } = useCommandPalette();

  return (
    <ErrorState
      icon={FileQuestion}
      code="Error 404"
      title="Page not found"
      description="This page doesn't exist or has moved. If you followed a link to a booking or a ticket, search for it instead."
      actions={
        <>
          <Button variant="secondary" onClick={openPalette}>
            <Search size={14} />
            Search
          </Button>
          <Button variant="primary" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </>
      }
    />
  );
}
