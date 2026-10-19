import mongoose from "mongoose";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import { authenticateAccessToken } from "../middleware/auth.js";
import { hasPermission } from "../middleware/rbac.js";
import { verifySimulatorToken } from "../utils/jwt.js";
import { ACCESS_COOKIE } from "../utils/cookies.js";
import { MAX_MESSAGE_LENGTH, postCustomerMessage } from "../services/ticket.service.js";
import { ROOMS, setIO } from "./emitter.js";

export { getIO } from "./emitter.js";

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    try {
      cookies[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
    } catch {
      // malformed cookie value - ignore it
    }
  }
  return cookies;
}

function socketError(message, code) {
  const err = new Error(message);
  err.data = { code };
  return err;
}

function isObjectId(value) {
  return typeof value === "string" && mongoose.isValidObjectId(value);
}

function reply(callback, payload) {
  if (typeof callback === "function") callback(payload);
}

// Staff sockets authenticate exactly like REST requests (same JWT checks,
// same live account status/role/tokenVersion lookup). Each one joins:
//   user:<id>     - so disabling a user / "log out everywhere" can drop it
//   session:<sid> - so signing out one device drops that device's socket
//   agents        - only with ticket.read (new tickets, queue updates)
//   approvers     - only with refund.approve (refund requests)
async function authenticateStaff(socket) {
  const cookies = parseCookies(socket.handshake.headers.cookie);
  const auth = await authenticateAccessToken(cookies[ACCESS_COOKIE]);

  socket.data.isSimulator = false;
  socket.data.userId = auth.userId;
  socket.data.role = auth.role;
  socket.data.sessionId = auth.sessionId ?? null;
}

function registerStaffHandlers(socket) {
  const { userId, role, sessionId } = socket.data;
  socket.join(ROOMS.user(userId));
  if (sessionId) socket.join(ROOMS.session(sessionId));
  if (hasPermission(role, "ticket.read")) socket.join(ROOMS.agents);
  if (hasPermission(role, "refund.approve")) socket.join(ROOMS.approvers);

  const canReadTickets = () => hasPermission(socket.data.role, "ticket.read");

  socket.on("ticket:join", (ticketId, callback) => {
    if (!canReadTickets()) return reply(callback, { ok: false, message: "Insufficient permissions" });
    if (!isObjectId(ticketId)) return reply(callback, { ok: false, message: "Invalid ticket" });
    socket.join(ROOMS.ticket(ticketId));
    reply(callback, { ok: true });
  });

  socket.on("ticket:leave", (ticketId) => {
    if (isObjectId(ticketId)) socket.leave(ROOMS.ticket(ticketId));
  });

  // "from" is decided by the server from the kind of socket, never taken
  // from the client, so nobody can fake the other side's typing indicator.
  socket.on("typing", ({ ticketId } = {}) => {
    if (!isObjectId(ticketId) || !socket.rooms.has(ROOMS.ticket(ticketId))) return;
    socket.to(ROOMS.ticket(ticketId)).emit("typing", { ticketId, from: "agent" });
  });

  socket.on("customer:message", (payload, callback) => {
    reply(callback, { ok: false, message: "Only the customer widget can send customer messages" });
  });
}

// Simulator sockets (the public demo customer widget) have no identity of
// their own. Each ticket they want to follow must be unlocked with the
// per-ticket token the API handed out when the ticket was opened or picked,
// and they can only ever see or post to those tickets.
function registerSimulatorHandlers(socket) {
  const unlocked = new Set();
  socket.data.tickets = unlocked;

  socket.on("ticket:join", (payload, callback) => {
    const { ticketId, token } = payload ?? {};
    if (!isObjectId(ticketId) || typeof token !== "string") {
      return reply(callback, { ok: false, message: "Invalid ticket" });
    }
    try {
      const claims = verifySimulatorToken(token);
      if (claims.ticketId !== ticketId) throw new Error("token/ticket mismatch");
    } catch {
      return reply(callback, { ok: false, message: "This chat link has expired. Start over." });
    }
    unlocked.add(ticketId);
    socket.join(ROOMS.ticket(ticketId));
    reply(callback, { ok: true });
  });

  socket.on("ticket:leave", (payload) => {
    const ticketId = typeof payload === "string" ? payload : payload?.ticketId;
    if (!isObjectId(ticketId)) return;
    unlocked.delete(ticketId);
    socket.leave(ROOMS.ticket(ticketId));
  });

  socket.on("typing", ({ ticketId } = {}) => {
    if (!unlocked.has(ticketId)) return;
    socket.to(ROOMS.ticket(ticketId)).emit("typing", { ticketId, from: "customer" });
  });

  socket.on("customer:message", async ({ ticketId, text } = {}, callback) => {
    if (!unlocked.has(ticketId)) {
      return reply(callback, { ok: false, message: "Open the ticket before sending messages" });
    }
    if (typeof text !== "string" || !text.trim()) {
      return reply(callback, { ok: false, message: "Message can't be empty" });
    }
    if (text.trim().length > MAX_MESSAGE_LENGTH) {
      return reply(callback, { ok: false, message: "Message is too long" });
    }

    try {
      const { message } = await postCustomerMessage(ticketId, text.trim());
      reply(callback, { ok: true, message });
    } catch (err) {
      reply(callback, { ok: false, message: err.statusCode === 404 ? err.message : "Something went wrong" });
    }
  });
}

export function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      // Same allow-list as the REST API (see app.js).
      origin(origin, callback) {
        if (!origin || env.CLIENT_URL.includes(origin)) {
          return callback(null, true);
        }
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  io.use(async (socket, next) => {
    try {
      if (socket.handshake.auth?.role === "simulator") {
        if (!env.DEMO_MODE) {
          return next(socketError("The customer simulator is disabled", "FEATURE_DISABLED"));
        }
        socket.data.isSimulator = true;
        return next();
      }

      await authenticateStaff(socket);
      next();
    } catch (err) {
      next(socketError(err.statusCode === 401 ? err.message : "Connection refused", err.code ?? "AUTH_REQUIRED"));
    }
  });

  io.on("connection", (socket) => {
    if (socket.data.isSimulator) {
      registerSimulatorHandlers(socket);
    } else {
      registerStaffHandlers(socket);
    }
  });

  setIO(io);
  return io;
}
