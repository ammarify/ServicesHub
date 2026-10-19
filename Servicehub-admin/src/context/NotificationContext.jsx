import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext(null);

const MAX_NOTIFICATIONS = 30;

function storageKey(userId) {
  return `servihub-notifications:${userId}`;
}

function readStored(userId) {
  if (!userId) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(userId)) ?? "[]");
    return Array.isArray(parsed) ? parsed.slice(0, MAX_NOTIFICATIONS) : [];
  } catch {
    return [];
  }
}

// The topbar bell's feed: realtime events (new tickets, customer replies,
// refund requests/decisions) collected by layouts/RealtimeBridge.jsx. Kept
// per user in localStorage so a page refresh doesn't wipe it; it's a
// convenience feed, not a source of truth - every item links to the real
// record.
export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState(() => ({ userId, items: readStored(userId) }));

  // Switch feeds when a different user signs in on this browser.
  const items = state.userId === userId ? state.items : readStored(userId);
  if (state.userId !== userId) {
    setState({ userId, items });
  }

  useEffect(() => {
    if (!userId) return;
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(items));
    } catch {
      // storage full or blocked - the feed just won't survive a refresh
    }
  }, [userId, items]);

  const addNotification = useCallback((notification) => {
    setState((prev) => {
      // The same event can arrive twice (e.g. two rooms); keep one.
      if (prev.items.some((item) => item.id === notification.id)) return prev;
      const next = [{ read: false, at: new Date().toISOString(), ...notification }, ...prev.items];
      return { ...prev, items: next.slice(0, MAX_NOTIFICATIONS) };
    });
  }, []);

  const markRead = useCallback((id) => {
    setState((prev) => ({ ...prev, items: prev.items.map((item) => (item.id === id ? { ...item, read: true } : item)) }));
  }, []);

  const markAllRead = useCallback(() => {
    setState((prev) => ({ ...prev, items: prev.items.map((item) => ({ ...item, read: true })) }));
  }, []);

  const clearAll = useCallback(() => {
    setState((prev) => ({ ...prev, items: [] }));
  }, []);

  const value = useMemo(
    () => ({
      notifications: items,
      unreadCount: items.filter((item) => !item.read).length,
      addNotification,
      markRead,
      markAllRead,
      clearAll,
    }),
    [items, addNotification, markRead, markAllRead, clearAll]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationProvider");
  return ctx;
}
