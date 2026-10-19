import http from "node:http";
import { io as connectClient } from "socket.io-client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "../../src/config/env.js";
import { initSockets } from "../../src/sockets/index.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";
import { createBooking, createCustomer, createTeam, createTicket } from "../helpers/factories.js";
import { anonymous, app, cookieHeaderFrom, signIn } from "../helpers/http.js";
import { DEFAULT_PASSWORD } from "../helpers/factories.js";

let server;
let io;
let baseUrl;
const openClients = [];

beforeAll(async () => {
  await connectTestDb();
  server = http.createServer(app);
  io = initSockets(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  io.close();
  await disconnectTestDb();
});

let team;

beforeEach(async () => {
  await clearTestDb();
  env.DEMO_MODE = true;
  team = await createTeam();
});

afterEach(() => {
  while (openClients.length) openClients.pop().disconnect();
});

async function staffCookie(user) {
  const res = await anonymous().post("/api/auth/login").send({ email: user.email, password: DEFAULT_PASSWORD });
  return cookieHeaderFrom(res);
}

function connect(options) {
  const client = connectClient(baseUrl, { transports: ["websocket"], forceNew: true, reconnection: false, ...options });
  openClients.push(client);
  return client;
}

function connected(client) {
  return new Promise((resolve, reject) => {
    client.once("connect", () => resolve(client));
    client.once("connect_error", reject);
  });
}

function nextEvent(client, event, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), timeoutMs);
    client.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function emitWithAck(client, event, payload) {
  return new Promise((resolve) => client.emit(event, payload, resolve));
}

async function staffSocket(user) {
  return connected(connect({ extraHeaders: { cookie: await staffCookie(user) } }));
}

async function simulatorSocket() {
  return connected(connect({ auth: { role: "simulator" } }));
}

describe("staff connections", () => {
  it("requires a valid session", async () => {
    const err = await connected(connect()).catch((error) => error);
    expect(err.data.code).toBe("AUTH_REQUIRED");
  });

  it("refuses a disabled account even with a token that hasn't expired", async () => {
    const cookie = await staffCookie(team.support_agent);
    await team.support_agent.updateOne({ status: "disabled" });
    const { invalidateAuthCache } = await import("../../src/middleware/auth.js");
    invalidateAuthCache(team.support_agent._id);

    const err = await connected(connect({ extraHeaders: { cookie } })).catch((error) => error);
    expect(err.data.code).toBe("ACCOUNT_DISABLED");
  });

  it("drops a live socket the moment its user is disabled", async () => {
    const socket = await staffSocket(team.support_agent);
    const disconnected = nextEvent(socket, "disconnect");

    const admin = await signIn(team.super_admin);
    await admin.patch(`/api/team/${team.support_agent._id}/status`).send({ status: "disabled" });

    expect(await disconnected).toBe("io server disconnect");
  });

  it("drops the socket of a device that signs out", async () => {
    const cookie = await staffCookie(team.manager);
    const socket = await connected(connect({ extraHeaders: { cookie } }));
    const disconnected = nextEvent(socket, "disconnect");

    await anonymous().post("/api/auth/logout").set("Cookie", cookie);
    expect(await disconnected).toBe("io server disconnect");
  });

  it("only lets roles with ticket.read follow tickets", async () => {
    const ticket = await createTicket();
    const finance = await staffSocket(team.finance);
    const support = await staffSocket(team.support_agent);

    expect(await emitWithAck(finance, "ticket:join", ticket._id.toString())).toMatchObject({ ok: false });
    expect(await emitWithAck(support, "ticket:join", ticket._id.toString())).toEqual({ ok: true });
  });
});

describe("live support flow", () => {
  it("notifies agents of new tickets, but not finance", async () => {
    const support = await staffSocket(team.support_agent);
    const finance = await staffSocket(team.finance);
    let financeHeard = false;
    finance.on("ticket:new", () => {
      financeHeard = true;
    });

    const customer = await createCustomer({ name: "Nora New" });
    const booking = await createBooking({ customer: customer._id });
    const heard = nextEvent(support, "ticket:new");
    await anonymous().post("/api/tickets").send({
      customerId: customer._id,
      bookingId: booking._id,
      subject: "Fresh issue",
      text: "Hello?",
      priority: "high",
    });

    expect(await heard).toMatchObject({ subject: "Fresh issue", customer: { name: "Nora New" } });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(financeHeard).toBe(false);
  });

  it("carries messages both ways once the simulator unlocks its ticket", async () => {
    const ticket = await createTicket();
    const { body } = await anonymous()
      .post("/api/tickets/simulator/session")
      .send({ customerId: ticket.customer, ticketId: ticket._id });

    const customer = await simulatorSocket();
    const agent = await staffSocket(team.support_agent);
    const ticketId = ticket._id.toString();

    expect(await emitWithAck(customer, "ticket:join", { ticketId, token: body.token })).toEqual({ ok: true });
    expect(await emitWithAck(agent, "ticket:join", ticketId)).toEqual({ ok: true });

    // customer -> agent
    const agentHears = nextEvent(agent, "ticket:message");
    const ack = await emitWithAck(customer, "customer:message", { ticketId, text: "Hello from the widget" });
    expect(ack.ok).toBe(true);
    expect((await agentHears).message).toMatchObject({ from: "customer", text: "Hello from the widget" });

    // agent -> customer (REST write, socket delivery)
    const customerHears = nextEvent(customer, "ticket:message");
    const agentHttp = await signIn(team.support_agent);
    await agentHttp.post(`/api/tickets/${ticketId}/messages`).send({ text: "Hi! On it." });
    expect((await customerHears).message).toMatchObject({ from: "agent", text: "Hi! On it." });

    // typing is relayed with a server-assigned "from"
    const typingSeenByAgent = nextEvent(agent, "typing");
    customer.emit("typing", { ticketId, from: "agent" });
    expect(await typingSeenByAgent).toEqual({ ticketId, from: "customer" });
  });

  it("keeps the simulator out of tickets it has no token for", async () => {
    const mine = await createTicket();
    const other = await createTicket();
    const { body } = await anonymous()
      .post("/api/tickets/simulator/session")
      .send({ customerId: mine.customer, ticketId: mine._id });
    const customer = await simulatorSocket();

    expect(await emitWithAck(customer, "ticket:join", { ticketId: other._id.toString(), token: body.token })).toMatchObject({
      ok: false,
    });
    expect(await emitWithAck(customer, "ticket:join", { ticketId: other._id.toString() })).toMatchObject({ ok: false });
    expect(
      await emitWithAck(customer, "customer:message", { ticketId: other._id.toString(), text: "sneaky" })
    ).toMatchObject({ ok: false });
  });

  it("stops staff sockets from posting as a customer", async () => {
    const ticket = await createTicket();
    const agent = await staffSocket(team.support_agent);
    const ack = await emitWithAck(agent, "customer:message", { ticketId: ticket._id.toString(), text: "spoof" });
    expect(ack.ok).toBe(false);
  });

  it("refuses simulator connections when DEMO_MODE is off", async () => {
    env.DEMO_MODE = false;
    const err = await connected(connect({ auth: { role: "simulator" } })).catch((error) => error);
    expect(err.data.code).toBe("FEATURE_DISABLED");
  });

  it("tells approvers about new refund requests", async () => {
    const finance = await staffSocket(team.finance);
    const booking = await createBooking({ amount: 100 });
    const heard = nextEvent(finance, "refund:requested");
    const agentHttp = await signIn(team.support_agent);
    await agentHttp.post("/api/refunds").send({ bookingId: booking._id, amount: 40, reason: "Late" });
    expect(await heard).toMatchObject({ amount: 40, bookingCode: booking.code, requestedByName: team.support_agent.name });
  });
});
