import { Server } from "socket.io";
import { env } from "../config/env.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { Ticket, Customer } from "../models/index.js";
import { appendMessage } from "../services/ticket.service.js";

const MAX_MESSAGE_LENGTH = 2000;

let io = null;

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    cookies[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  }
  return cookies;
}

// Sockets are a delivery layer only - every mutation here (appendMessage +
// ticket.save()) is the exact same service call the REST controllers use,
// so there is one write path regardless of whether a message arrives via
// HTTP or a socket event.
function registerConnectionHandlers(socket) {
  if (!socket.data.isSimulator) {
    socket.join("agents");
  }

  socket.on("ticket:join", (ticketId) => {
    if (typeof ticketId === "string" && ticketId) socket.join(`ticket:${ticketId}`);
  });

  socket.on("ticket:leave", (ticketId) => {
    if (typeof ticketId === "string" && ticketId) socket.leave(`ticket:${ticketId}`);
  });

  // Passthrough, but "from" is derived server-side from which kind of
  // socket this is rather than trusted from the client payload - otherwise
  // a simulator connection (or any client) could claim from: "agent" and
  // spoof a staff typing indicator, or vice versa. The 2s auto-clear is a
  // client-side concern.
  socket.on("typing", ({ ticketId } = {}) => {
    if (typeof ticketId !== "string" || !ticketId) return;
    const from = socket.data.isSimulator ? "customer" : "agent";
    socket.to(`ticket:${ticketId}`).emit("typing", { ticketId, from });
  });

  socket.on("customer:message", async ({ ticketId, text } = {}, callback) => {
    const ack = typeof callback === "function" ? callback : () => {};

    if (!socket.data.isSimulator) {
      return ack({ ok: false, message: "Only the simulator can send customer messages" });
    }
    if (typeof ticketId !== "string" || !ticketId || typeof text !== "string" || !text.trim()) {
      return ack({ ok: false, message: "Invalid payload" });
    }
    if (text.trim().length > MAX_MESSAGE_LENGTH) {
      return ack({ ok: false, message: "Message is too long" });
    }

    try {
      const ticket = await Ticket.findById(ticketId);
      if (!ticket) return ack({ ok: false, message: "Ticket not found" });

      const customer = await Customer.findById(ticket.customer);
      if (!customer) return ack({ ok: false, message: "Customer not found" });

      const message = appendMessage(ticket, {
        from: "customer",
        senderName: customer.name,
        text: text.trim(),
      });
      await ticket.save();

      io.to(`ticket:${ticketId}`).emit("ticket:message", { ticketId, message });
      ack({ ok: true, message });
    } catch {
      ack({ ok: false, message: "Something went wrong" });
    }
  });
}

export function initSockets(httpServer) {
  io = new Server(httpServer, {
    cors: {
      // Same reasoning as app.js's CORS config: an explicit allow-list
      // function instead of a static string, so only a genuinely matching
      // Origin gets reflected back.
      origin(origin, callback) {
        if (!origin || origin === env.CLIENT_URL) {
          return callback(null, true);
        }
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE"],
    },
  });

  io.use((socket, next) => {
    if (socket.handshake.auth?.role === "simulator") {
      socket.data.isSimulator = true;
      return next();
    }

    const cookies = parseCookies(socket.handshake.headers.cookie);
    const token = cookies.accessToken;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const payload = verifyAccessToken(token);
      socket.data.isSimulator = false;
      socket.data.userId = payload.userId;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error("Invalid or expired session"));
    }
  });

  io.on("connection", registerConnectionHandlers);

  return io;
}

// Returns null (rather than throwing) if sockets haven't been initialized -
// controllers use `getIO()?.to(...)` so a request never fails just because
// the delivery layer isn't up.
export function getIO() {
  return io;
}
