import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "../../src/config/env.js";
import { Session, User } from "../../src/models/index.js";
import { permissionsForRole } from "../../src/middleware/rbac.js";
import { testOutbox } from "../../src/services/email.service.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";
import { createTeam, createUser, DEFAULT_PASSWORD } from "../helpers/factories.js";
import { anonymous, app, cookieHeaderFrom, findCookie, signIn } from "../helpers/http.js";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(async () => {
  await clearTestDb();
  testOutbox.length = 0;
  env.DEMO_MODE = true;
});

function linkTokenFrom(message) {
  return new URL(message.text.match(/https?:\/\/\S+/)[0]).searchParams.get("token");
}

describe("login", () => {
  it("signs in and returns the user's permissions", async () => {
    const user = await createUser({ role: "finance" });
    const res = await anonymous().post("/api/auth/login").send({ email: user.email, password: DEFAULT_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: user._id.toString(), role: "finance", status: "active" });
    expect(res.body.user.permissions).toEqual(permissionsForRole("finance"));
    expect(res.body.user.passwordHash).toBeUndefined();

    const access = findCookie(res, "accessToken", "/");
    const refresh = findCookie(res, "sh_refresh", "/api/auth");
    expect(access?.httponly).toBe(true);
    expect(refresh?.httponly).toBe(true);
    // Without "keep me logged in" both are browser-session cookies.
    expect(access["max-age"]).toBeUndefined();
    expect(refresh["max-age"]).toBeUndefined();
    // The cookie from older releases at the narrower path is cleared.
    expect(findCookie(res, "refreshToken", "/api/auth/refresh")?.expires).toMatch(/1970/);
  });

  it("keeps the session across browser restarts when 'keep me logged in' is ticked", async () => {
    const user = await createUser();
    const res = await anonymous()
      .post("/api/auth/login")
      .send({ email: user.email, password: DEFAULT_PASSWORD, remember: true });

    expect(res.status).toBe(200);
    const thirtyDays = 30 * 24 * 60 * 60;
    expect(Number(findCookie(res, "accessToken", "/")["max-age"])).toBeGreaterThan(thirtyDays - 60);
    expect(Number(findCookie(res, "sh_refresh", "/api/auth")["max-age"])).toBeGreaterThan(thirtyDays - 60);
    expect(await Session.countDocuments({ user: user._id, remember: true })).toBe(1);
  });

  it("gives the same answer for an unknown email and a wrong password", async () => {
    const user = await createUser();
    const wrongPassword = await anonymous().post("/api/auth/login").send({ email: user.email, password: "Nope12345" });
    const unknownEmail = await anonymous()
      .post("/api/auth/login")
      .send({ email: "nobody@servihub.test", password: "Nope12345" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  it("rejects disabled accounts", async () => {
    const user = await createUser({ status: "disabled" });
    const res = await anonymous().post("/api/auth/login").send({ email: user.email, password: DEFAULT_PASSWORD });
    expect(res.status).toBe(403);
  });

  it("treats the email case-insensitively", async () => {
    const user = await createUser();
    const res = await anonymous()
      .post("/api/auth/login")
      .send({ email: user.email.toUpperCase(), password: DEFAULT_PASSWORD });
    expect(res.status).toBe(200);
  });
});

describe("access tokens", () => {
  it("reports AUTH_REQUIRED without a token", async () => {
    const res = await anonymous().get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTH_REQUIRED");
  });

  it("reports TOKEN_EXPIRED for an expired token so the client can refresh silently", async () => {
    const user = await createUser();
    const expired = jwt.sign(
      { userId: user._id.toString(), role: user.role, sid: "000000000000000000000000", tv: 0, exp: Math.floor(Date.now() / 1000) - 10 },
      env.JWT_ACCESS_SECRET,
      { issuer: "servihub-api", audience: "servihub-admin" }
    );
    const res = await anonymous().get("/api/auth/me").set("Cookie", `accessToken=${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("TOKEN_EXPIRED");
  });

  it("rejects tokens signed for another purpose", async () => {
    const user = await createUser();
    const wrongAudience = jwt.sign({ userId: user._id.toString(), tv: 0 }, env.JWT_ACCESS_SECRET, {
      issuer: "servihub-api",
      audience: "servihub-simulator",
    });
    const res = await anonymous().get("/api/auth/me").set("Cookie", `accessToken=${wrongAudience}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_TOKEN");
  });
});

describe("refresh token rotation", () => {
  it("issues a new token pair and invalidates the old refresh token", async () => {
    const user = await createUser();
    const login = await anonymous().post("/api/auth/login").send({ email: user.email, password: DEFAULT_PASSWORD });
    const firstCookies = cookieHeaderFrom(login);

    const refreshed = await anonymous().post("/api/auth/refresh").set("Cookie", firstCookies);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.user.id).toBe(user._id.toString());
    const secondCookies = cookieHeaderFrom(refreshed);
    expect(findCookie(refreshed, "sh_refresh", "/api/auth").value).not.toBe(
      findCookie(login, "sh_refresh", "/api/auth").value
    );

    // Pretend the grace window for concurrent tabs has passed.
    await Session.updateMany({ user: user._id }, { $set: { rotatedAt: new Date(Date.now() - 60_000) } });

    // Replaying the first refresh token now looks like theft: the whole
    // session is revoked, including the legitimately rotated token.
    const replay = await anonymous().post("/api/auth/refresh").set("Cookie", firstCookies);
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe("SESSION_REVOKED");

    const afterReplay = await anonymous().post("/api/auth/refresh").set("Cookie", secondCookies);
    expect(afterReplay.status).toBe(401);
    expect((await Session.findOne({ user: user._id })).revokedReason).toBe("refresh_token_reuse");

    // The access token the legitimate rotation handed out is dead too.
    const me = await anonymous().get("/api/auth/me").set("Cookie", secondCookies);
    expect(me.status).toBe(401);
    expect(me.body.code).toBe("SESSION_REVOKED");
  });

  it("lets two tabs refresh with the same token at the same moment", async () => {
    const user = await createUser();
    const login = await anonymous().post("/api/auth/login").send({ email: user.email, password: DEFAULT_PASSWORD });
    const cookies = cookieHeaderFrom(login);

    const [a, b] = await Promise.all([
      anonymous().post("/api/auth/refresh").set("Cookie", cookies),
      anonymous().post("/api/auth/refresh").set("Cookie", cookies),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
  });

  it("works through the cookie paths a browser would use", async () => {
    const user = await createUser();
    const agent = await signIn(user);
    const res = await agent.post("/api/auth/refresh");
    expect(res.status).toBe(200);
    expect((await agent.get("/api/auth/me")).status).toBe(200);
  });

  it("fails without a refresh cookie", async () => {
    const res = await anonymous().post("/api/auth/refresh");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("SESSION_EXPIRED");
  });
});

describe("logout", () => {
  it("revokes the session so its refresh token stops working", async () => {
    const user = await createUser();
    const login = await anonymous().post("/api/auth/login").send({ email: user.email, password: DEFAULT_PASSWORD });
    const cookies = cookieHeaderFrom(login);

    const logout = await anonymous().post("/api/auth/logout").set("Cookie", cookies);
    expect(logout.status).toBe(200);
    expect(findCookie(logout, "accessToken", "/").expires).toMatch(/1970/);

    const refresh = await anonymous().post("/api/auth/refresh").set("Cookie", cookies);
    expect(refresh.status).toBe(401);
    expect((await Session.findOne({ user: user._id })).revokedReason).toBe("logout");
  });

  it("also ends the access token issued for that session, not just the refresh token", async () => {
    const user = await createUser();
    const login = await anonymous().post("/api/auth/login").send({ email: user.email, password: DEFAULT_PASSWORD });
    const cookies = cookieHeaderFrom(login);
    expect((await anonymous().get("/api/auth/me").set("Cookie", cookies)).status).toBe(200);

    await anonymous().post("/api/auth/logout").set("Cookie", cookies);

    // A copy of the (still unexpired) access token is useless after sign-out.
    const me = await anonymous().get("/api/auth/me").set("Cookie", cookies);
    expect(me.status).toBe(401);
    expect(me.body.code).toBe("SESSION_REVOKED");
  });

  it("leaves the user's other sessions alone", async () => {
    const user = await createUser();
    const laptop = await signIn(user);
    const phone = await signIn(user);

    expect((await laptop.post("/api/auth/logout")).status).toBe(200);

    expect((await phone.get("/api/auth/me")).status).toBe(200);
    expect((await phone.post("/api/auth/refresh")).status).toBe(200);
  });

  it("'log out everywhere' ends every session immediately", async () => {
    const user = await createUser();
    const laptop = await signIn(user);
    const phone = await signIn(user);

    expect((await laptop.post("/api/auth/logout-all")).status).toBe(200);

    const phoneMe = await phone.get("/api/auth/me");
    expect(phoneMe.status).toBe(401);
    expect(phoneMe.body.code).toBe("SESSION_REVOKED");
    expect((await phone.post("/api/auth/refresh")).status).toBe(401);
    expect(await Session.countDocuments({ user: user._id, revokedAt: null })).toBe(0);
  });
});

describe("demo login", () => {
  it("signs in as the oldest active user with the role while DEMO_MODE is on", async () => {
    const team = await createTeam();
    const res = await anonymous().post("/api/auth/demo-login").send({ role: "manager" });
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(team.manager._id.toString());
  });

  it("does not exist when DEMO_MODE is off", async () => {
    await createTeam();
    env.DEMO_MODE = false;
    const res = await anonymous().post("/api/auth/demo-login").send({ role: "super_admin" });
    expect(res.status).toBe(404);
  });
});

describe("profile and password", () => {
  it("updates the display name", async () => {
    const user = await createUser();
    const agent = await signIn(user);
    const res = await agent.patch("/api/auth/me").send({ name: "Renamed Person" });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe("Renamed Person");
  });

  it("changes the password, keeps this device signed in and signs out the others", async () => {
    const user = await createUser();
    const current = await signIn(user);
    const other = await signIn(user);

    const wrong = await current
      .post("/api/auth/change-password")
      .send({ currentPassword: "Incorrect1", newPassword: "BrandNew123" });
    expect(wrong.status).toBe(400);
    expect(wrong.body.errors.currentPassword).toBeDefined();

    const weak = await current
      .post("/api/auth/change-password")
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: "short" });
    expect(weak.status).toBe(400);

    const ok = await current
      .post("/api/auth/change-password")
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: "BrandNew123" });
    expect(ok.status).toBe(200);

    expect((await current.get("/api/auth/me")).status).toBe(200);
    expect((await other.get("/api/auth/me")).status).toBe(401);

    const oldLogin = await anonymous().post("/api/auth/login").send({ email: user.email, password: DEFAULT_PASSWORD });
    expect(oldLogin.status).toBe(401);
    const newLogin = await anonymous().post("/api/auth/login").send({ email: user.email, password: "BrandNew123" });
    expect(newLogin.status).toBe(200);
  });
});

describe("forgot / reset password", () => {
  it("answers the same way for unknown emails and sends nothing", async () => {
    const res = await anonymous().post("/api/auth/forgot-password").send({ email: "ghost@servihub.test" });
    expect(res.status).toBe(200);
    expect(testOutbox).toHaveLength(0);
  });

  it("emails a single-use link that resets the password and ends all sessions", async () => {
    const user = await createUser({ name: "Rita Reset" });
    const existingSession = await signIn(user);

    const res = await anonymous().post("/api/auth/forgot-password").send({ email: user.email });
    expect(res.status).toBe(200);
    expect(testOutbox).toHaveLength(1);
    expect(testOutbox[0].to).toBe(user.email);
    const token = linkTokenFrom(testOutbox[0]);
    expect(testOutbox[0].text).toContain("http://localhost:5173/reset-password?token=");

    const verify = await anonymous().post("/api/auth/reset-password/verify").send({ token });
    expect(verify.status).toBe(200);
    expect(verify.body).toMatchObject({ purpose: "reset", name: "Rita Reset", email: user.email });

    const weak = await anonymous().post("/api/auth/reset-password").send({ token, password: "password" });
    expect(weak.status).toBe(400);

    const reset = await anonymous().post("/api/auth/reset-password").send({ token, password: "Fresh12345" });
    expect(reset.status).toBe(200);

    expect((await existingSession.get("/api/auth/me")).status).toBe(401);
    const login = await anonymous().post("/api/auth/login").send({ email: user.email, password: "Fresh12345" });
    expect(login.status).toBe(200);

    const reuse = await anonymous().post("/api/auth/reset-password").send({ token, password: "Another123" });
    expect(reuse.status).toBe(400);
    expect(reuse.body.code).toBe("INVALID_PASSWORD_TOKEN");
  });

  it("only honours the newest link", async () => {
    const user = await createUser();
    await anonymous().post("/api/auth/forgot-password").send({ email: user.email });
    await anonymous().post("/api/auth/forgot-password").send({ email: user.email });
    const [first, second] = testOutbox.map(linkTokenFrom);

    expect((await anonymous().post("/api/auth/reset-password/verify").send({ token: first })).status).toBe(400);
    expect((await anonymous().post("/api/auth/reset-password/verify").send({ token: second })).status).toBe(200);
  });

  it("does not email disabled accounts", async () => {
    const user = await createUser({ status: "disabled" });
    await anonymous().post("/api/auth/forgot-password").send({ email: user.email });
    expect(testOutbox).toHaveLength(0);
  });
});

describe("account changes by an admin", () => {
  it("signs a member out immediately when their role changes", async () => {
    const team = await createTeam();
    const admin = await signIn(team.super_admin);
    const target = await signIn(team.support_agent);
    expect((await target.get("/api/tickets")).status).toBe(200);

    const change = await admin.patch(`/api/team/${team.support_agent._id}/role`).send({ role: "finance" });
    expect(change.status).toBe(200);

    const after = await target.get("/api/auth/me");
    expect(after.status).toBe(401);
    expect(after.body.code).toBe("SESSION_REVOKED");

    const relogin = await signIn(team.support_agent);
    const me = await relogin.get("/api/auth/me");
    expect(me.body.user.role).toBe("finance");
    expect((await relogin.get("/api/tickets")).status).toBe(403);
  });

  it("blocks a disabled member's existing session at once", async () => {
    const team = await createTeam();
    const admin = await signIn(team.super_admin);
    const target = await signIn(team.manager);

    await admin.patch(`/api/team/${team.manager._id}/status`).send({ status: "disabled" });

    const res = await target.get("/api/bookings");
    expect(res.status).toBe(401);
    expect(["ACCOUNT_DISABLED", "SESSION_REVOKED"]).toContain(res.body.code);
    expect((await target.post("/api/auth/refresh")).status).toBe(401);
    expect((await User.findById(team.manager._id)).status).toBe("disabled");
  });
});

describe("public config", () => {
  it("exposes the settings the login page needs", async () => {
    const res = await request(app).get("/api/config");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ demoMode: true, googleClientId: null, aiEnabled: false });
    expect(res.body.services).toContain("Plumbing");
  });
});
