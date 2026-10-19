import { io as ioClient } from "socket.io-client";
import { refreshSession } from "./api";

const SOCKET_URL = new URL(import.meta.env.VITE_API_URL).origin;

// Handshake rejections a token refresh can fix.
const REFRESHABLE = new Set(["TOKEN_EXPIRED", "AUTH_REQUIRED", "INVALID_TOKEN"]);

// Staff socket. It authenticates with the same httpOnly cookies as the REST
// API, so the browser sends them automatically (withCredentials).
//
// Two situations need help beyond socket.io's own auto-reconnect:
// - the access token expired while the socket was down, so the reconnect
//   handshake is refused: refresh the session, then connect again;
// - the server dropped us on purpose ("io server disconnect", e.g. after a
//   password change on this device issued new cookies): reconnect once,
//   which succeeds only if the session is still valid.
export function createStaffSocket({ onSessionLost } = {}) {
  const socket = ioClient(SOCKET_URL, {
    withCredentials: true,
    autoConnect: false,
  });

  let refreshing = false;
  // Stops a refresh -> reconnect -> refused loop if cookies never reach the
  // socket endpoint (e.g. a misconfigured cross-site deployment).
  let refreshAttempts = 0;

  socket.on("connect", () => {
    refreshAttempts = 0;
  });

  socket.on("connect_error", async (err) => {
    const code = err?.data?.code;
    if (!REFRESHABLE.has(code) || refreshing || refreshAttempts >= 2) {
      if (code === "ACCOUNT_DISABLED" || code === "SESSION_REVOKED") onSessionLost?.(code);
      return;
    }

    refreshing = true;
    refreshAttempts += 1;
    try {
      await refreshSession();
      socket.connect();
    } catch {
      onSessionLost?.("SESSION_EXPIRED");
    } finally {
      refreshing = false;
    }
  });

  socket.on("disconnect", (reason) => {
    if (reason === "io server disconnect") {
      // Give a just-completed cookie update (e.g. password change) a moment.
      setTimeout(() => socket.connect(), 500);
    }
  });

  return socket;
}

// Customer-simulator socket: no cookies or login. Tickets are unlocked one
// at a time with the per-ticket token the API hands out.
export function createSimulatorSocket() {
  return ioClient(SOCKET_URL, {
    auth: { role: "simulator" },
    autoConnect: false,
  });
}
