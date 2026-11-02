import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../src/config/env.js";
import { Booking, DemoState, Ticket, User } from "../../src/models/index.js";
import { isResetDue, resetDemoDataIfDue } from "../../src/services/demoReset.service.js";
import { testOutbox } from "../../src/services/email.service.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";
import { createTeam, createUser, DEFAULT_PASSWORD } from "../helpers/factories.js";
import { anonymous, signIn } from "../helpers/http.js";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

beforeEach(async () => {
  await clearTestDb();
  testOutbox.length = 0;
  env.DEMO_MODE = true;
});

afterEach(() => {
  env.DEMO_MODE = true;
  env.DEMO_RESET_HOURS = undefined;
  env.DEBUG_PROXY_HEADERS = false;
});

const HOUR_MS = 60 * 60 * 1000;

describe("shared demo accounts", () => {
  it("can't have their role or status changed while demo mode is on", async () => {
    const team = await createTeam();
    const shared = await createUser({ role: "support_agent", name: "Madison Carter", demoAccount: true });
    const admin = await signIn(team.super_admin);

    const role = await admin.patch(`/api/team/${shared._id}/role`).send({ role: "finance" });
    expect(role.status).toBe(403);
    expect(role.body).toMatchObject({ code: "DEMO_LOCKED" });
    expect(role.body.message).toMatch(/Madison Carter is a shared demo account/);

    const status = await admin.patch(`/api/team/${shared._id}/status`).send({ status: "disabled" });
    expect(status.status).toBe(403);
    expect(status.body.code).toBe("DEMO_LOCKED");

    const stored = await User.findById(shared._id);
    expect(stored).toMatchObject({ role: "support_agent", status: "active" });
  });

  it("can be changed when demo mode is off", async () => {
    const team = await createTeam();
    const shared = await createUser({ role: "support_agent", demoAccount: true });
    const admin = await signIn(team.super_admin);
    env.DEMO_MODE = false;

    const res = await admin.patch(`/api/team/${shared._id}/role`).send({ role: "finance" });
    expect(res.status).toBe(200);
    expect(res.body.member.role).toBe("finance");
  });

  it("don't lock members invited during the demo", async () => {
    const team = await createTeam();
    const admin = await signIn(team.super_admin);

    const res = await admin.patch(`/api/team/${team.support_agent._id}/status`).send({ status: "disabled" });
    expect(res.status).toBe(200);
  });

  it("keep their password, name and sessions while demo mode is on", async () => {
    const shared = await createUser({ role: "manager", name: "Brianna Lopez", demoAccount: true });
    const agent = await signIn(shared);

    const me = await agent.get("/api/auth/me");
    expect(me.body.user.demoAccount).toBe(true);

    const password = await agent
      .post("/api/auth/change-password")
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: "Another-Pass-42" });
    expect(password.status).toBe(403);
    expect(password.body.code).toBe("DEMO_LOCKED");

    const profile = await agent.patch("/api/auth/me").send({ name: "Somebody Else" });
    expect(profile.status).toBe(403);

    const everywhere = await agent.post("/api/auth/logout-all");
    expect(everywhere.status).toBe(403);

    // Still signed in, same name.
    const after = await agent.get("/api/auth/me");
    expect(after.status).toBe(200);
    expect(after.body.user.name).toBe("Brianna Lopez");
  });

  it("can't get a new password through an invitation or reset link", async () => {
    const team = await createTeam();
    const shared = await createUser({ role: "finance", name: "Jessica Nguyen", demoAccount: true });
    const admin = await signIn(team.super_admin);

    const invite = await admin.post(`/api/team/${shared._id}/invite`);
    expect(invite.status).toBe(403);
    expect(invite.body.code).toBe("DEMO_LOCKED");

    await anonymous().post("/api/auth/forgot-password").send({ email: shared.email });
    const token = new URL(testOutbox[0].text.match(/https?:\/\/\S+/)[0]).searchParams.get("token");
    const reset = await anonymous().post("/api/auth/reset-password").send({ token, password: "Another-Pass-42" });
    expect(reset.status).toBe(403);
    expect(reset.body.code).toBe("DEMO_LOCKED");

    const login = await anonymous().post("/api/auth/login").send({ email: shared.email, password: DEFAULT_PASSWORD });
    expect(login.status).toBe(200);
  });
});

describe("demo data reset", () => {
  it("is due without a previous reset, and again once the interval has passed", () => {
    const now = new Date("2026-11-02T12:00:00Z");
    expect(isResetDue(null, 24, now)).toBe(true);
    expect(isResetDue(new Date(now.getTime() - 23 * HOUR_MS), 24, now)).toBe(false);
    expect(isResetDue(new Date(now.getTime() - 24 * HOUR_MS), 24, now)).toBe(true);
  });

  it("loads the demo data, keeps visitors' changes until the next reset, then starts over", async () => {
    const io = { disconnectSockets: vi.fn() };
    const visitor = await createUser({ role: "super_admin" });
    const visitorAgent = await signIn(visitor);
    const now = new Date("2026-11-02T12:00:00Z");

    expect(await resetDemoDataIfDue({ hours: 24, io, now })).toBe(true);
    expect(await User.countDocuments({ demoAccount: true })).toBeGreaterThanOrEqual(4);
    expect(await Booking.countDocuments()).toBeGreaterThan(10);
    expect((await DemoState.findById("demo")).lastResetAt.toISOString()).toBe(now.toISOString());
    expect(io.disconnectSockets).toHaveBeenCalledWith(true);
    // Everyone is signed out: sessions and users were replaced.
    expect((await visitorAgent.get("/api/auth/me")).status).toBe(401);

    await Ticket.deleteMany({});
    expect(await resetDemoDataIfDue({ hours: 24, io, now: new Date(now.getTime() + HOUR_MS) })).toBe(false);
    expect(await Ticket.countDocuments()).toBe(0);

    expect(await resetDemoDataIfDue({ hours: 24, io, now: new Date(now.getTime() + 25 * HOUR_MS) })).toBe(true);
    expect(await Ticket.countDocuments()).toBeGreaterThan(0);
  }, 120_000);

  it("tells the sign-in page how often the data resets", async () => {
    env.DEMO_RESET_HOURS = 24;
    expect((await anonymous().get("/api/config")).body.demoResetHours).toBe(24);

    env.DEMO_MODE = false;
    expect((await anonymous().get("/api/config")).body.demoResetHours).toBeNull();
  });
});

describe("proxy diagnostics", () => {
  it("stays off unless DEBUG_PROXY_HEADERS is set", async () => {
    expect((await anonymous().get("/api/health/client")).status).toBe(404);

    env.DEBUG_PROXY_HEADERS = true;
    const res = await anonymous().get("/api/health/client").set("X-Forwarded-For", "203.0.113.7");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ trustProxy: 0, forwardedFor: "203.0.113.7", realIp: null });
    expect(res.body.ip).toBeTruthy();
  });
});
