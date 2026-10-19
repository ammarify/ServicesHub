import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { createStaffSocket } from "../lib/socket";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

// One staff socket per signed-in session, shared by every realtime feature
// (support queue, conversations, notifications). Components get it from
// context rather than a module singleton, so effects that need it re-run as
// soon as it exists - including right after a page refresh.
export function SocketProvider({ children }) {
  const { user, expireSession } = useAuth();
  const userId = user?.id ?? null;

  // Created without connecting (autoConnect: false); the effect below owns
  // the connection lifetime.
  const socket = useMemo(
    () => (userId ? createStaffSocket({ onSessionLost: expireSession }) : null),
    [userId, expireSession]
  );

  useEffect(() => {
    if (!socket) return undefined;
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, [socket]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}

function subscribeToConnection(socket, onChange) {
  if (!socket) return () => {};
  socket.on("connect", onChange);
  socket.on("disconnect", onChange);
  socket.io.on("reconnect_attempt", onChange);
  return () => {
    socket.off("connect", onChange);
    socket.off("disconnect", onChange);
    socket.io.off("reconnect_attempt", onChange);
  };
}

// true / false while signed in; null when there is no socket at all.
export function useSocketConnected() {
  const socket = useSocket();
  return useSyncExternalStore(
    (onChange) => subscribeToConnection(socket, onChange),
    () => (socket ? socket.connected : null)
  );
}
