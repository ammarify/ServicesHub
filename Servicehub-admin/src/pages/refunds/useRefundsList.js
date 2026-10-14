import { useEffect, useState } from "react";
import { useRefunds } from "../../hooks/useRefunds";

export const TABS = ["pending", "approved", "rejected"];
// Approving/rejecting moves a refund straight out of the tab you're looking
// at (Pending) into another one (Approved/Rejected) — there's nothing to
// pulse in the current view the instant it happens. This window just needs
// to outlast "close the drawer, click the other tab", not match the 1s
// pulse animation itself.
const PULSE_ELIGIBILITY_MS = 5000;

export function useRefundsList() {
  const [activeTab, setActiveTab] = useState("pending");
  const [pulseRefundId, setPulseRefundId] = useState(null);

  const query = useRefunds(activeTab);
  const filteredRefunds = query.data?.items ?? [];
  const counts = query.data?.counts ?? { pending: 0, approved: 0, rejected: 0 };

  useEffect(() => {
    if (!pulseRefundId) return;
    const timer = setTimeout(() => setPulseRefundId(null), PULSE_ELIGIBILITY_MS);
    return () => clearTimeout(timer);
  }, [pulseRefundId]);

  return {
    activeTab,
    setActiveTab,
    counts,
    filteredRefunds,
    pulseRefundId,
    setPulseRefundId,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
