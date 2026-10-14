import { io as ioClient } from "socket.io-client";

const SOCKET_URL = new URL(import.meta.env.VITE_API_URL).origin;

let socket = null;

// Staff socket: authenticates via the same httpOnly cookies as the REST
// API (withCredentials), so it only ever connects after AuthContext has a
// signed-in user - see connectSocket()/disconnectSocket() calls there.
export function connectSocket() {
  if (socket) return socket;
  socket = ioClient(SOCKET_URL, {
    withCredentials: true,
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket() {
  return socket;
}

// Simulator socket: no cookies/login - the server grants it a restricted
// context purely from handshake auth ({ role: "simulator" }).
export function createSimulatorSocket() {
  return ioClient(SOCKET_URL, {
    auth: { role: "simulator" },
  });
}
