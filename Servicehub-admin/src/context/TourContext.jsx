import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { GuidedTour } from "../components/tour/GuidedTour";
import { buildTourSteps, isTargetVisible } from "../components/tour/tourSteps";
import { useAuth } from "./AuthContext";

const TourContext = createContext({ startTour: () => {} });

// Shown once per person per browser, after their first sign-in here.
const AUTO_START_DELAY_MS = 800;

function storageKey(userId) {
  return `servihub-tour:${userId}`;
}

function hasFinishedTour(userId) {
  try {
    return localStorage.getItem(storageKey(userId)) !== null;
  } catch {
    // Without storage we can't remember a skip, so don't risk showing the
    // tour on every visit.
    return true;
  }
}

function rememberTour(userId, outcome) {
  try {
    localStorage.setItem(storageKey(userId), outcome);
  } catch {
    // Not remembered; the tour may show again next time.
  }
}

export function TourProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [steps, setSteps] = useState(null);

  // Only steps whose element is on screen right now (a phone has no sidebar
  // until it's opened; the range picker exists only on the dashboard).
  const startTour = useCallback(() => {
    if (!user) return;
    setSteps(buildTourSteps(user).filter((step) => isTargetVisible(step.target)));
  }, [user]);

  useEffect(() => {
    if (!userId || hasFinishedTour(userId)) return undefined;
    const timer = setTimeout(startTour, AUTO_START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [userId, startTour]);

  const handleClose = useCallback(
    (outcome) => {
      setSteps(null);
      if (userId) rememberTour(userId, outcome);
    },
    [userId]
  );

  const value = useMemo(() => ({ startTour }), [startTour]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {steps && steps.length > 0 && <GuidedTour steps={steps} onClose={handleClose} />}
    </TourContext.Provider>
  );
}

export function useTour() {
  return useContext(TourContext);
}
