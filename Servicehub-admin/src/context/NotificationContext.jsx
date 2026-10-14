import { createContext, useCallback, useContext, useState } from "react";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [newTicketCount, setNewTicketCount] = useState(0);

  const incrementNewTicket = useCallback(() => setNewTicketCount((count) => count + 1), []);
  const clearNewTicket = useCallback(() => setNewTicketCount(0), []);

  return (
    <NotificationContext.Provider value={{ newTicketCount, incrementNewTicket, clearNewTicket }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationProvider");
  return ctx;
}
