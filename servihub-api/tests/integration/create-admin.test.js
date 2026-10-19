import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from "vitest";
import { PasswordToken, Session, User } from "../../src/models/index.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";
import { createUser } from "../helpers/factories.js";
import { anonymous, signIn } from "../helpers/http.js";

const run = promisify(execFile);
const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../scripts/create-admin.mjs");
// The script runs in its own process, from an empty directory so a
// developer's .env can't leak in, against this file's test database.
const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "servihub-create-admin-"));

beforeAll(connectTestDb);
afterAll(async () => {
  await disconnectTestDb();
  fs.rmSync(emptyDir, { recursive: true, force: true });
});
beforeEach(clearTestDb);

function testDbUri() {
  const url = new URL(inject("mongoUri"));
  url.pathname = `/${mongoose.connection.db.databaseName}`;
  return url.toString();
}

async function createAdmin(...args) {
  const options = { cwd: emptyDir, env: { ...process.env, MONGODB_URI: testDbUri() } };
  try {
    const { stdout, stderr } = await run(process.execPath, [SCRIPT, ...args], options);
    return { code: 0, stdout, stderr };
  } catch (err) {
    return { code: err.code, stdout: err.stdout, stderr: err.stderr };
  }
}

function linkToken(stdout) {
  const link = stdout.match(/https?:\/\/\S+\/reset-password\?token=\S+/)?.[0];
  return link ? new URL(link).searchParams.get("token") : null;
}

describe("create-admin script", () => {
  it("creates the first super admin and prints a working invitation link", async () => {
    const result = await createAdmin("--email", "Olivia@Company.test", "--name", "Olivia Owner");

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("created the account");
    const user = await User.findOne({ email: "olivia@company.test" });
    expect(user).toMatchObject({ name: "Olivia Owner", role: "super_admin", status: "active", passwordSetAt: null });

    const token = linkToken(result.stdout);
    expect(result.stdout).toContain("http://localhost:5173/reset-password?token=");
    const verify = await anonymous().post("/api/auth/reset-password/verify").send({ token });
    expect(verify.body).toMatchObject({ purpose: "invite", email: "olivia@company.test" });

    expect((await anonymous().post("/api/auth/reset-password").send({ token, password: "Owner12345" })).status).toBe(200);
    const login = await anonymous().post("/api/auth/login").send({ email: "olivia@company.test", password: "Owner12345" });
    expect(login.status).toBe(200);
    expect(login.body.user.permissions).toContain("team.manage");
  });

  it("needs a name to create a new account", async () => {
    const result = await createAdmin("--email", "new@company.test");

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("--name is required");
    expect(await User.countDocuments()).toBe(0);
  });

  it("rejects an invalid email", async () => {
    const result = await createAdmin("--email", "not-an-email", "--name", "Someone");

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Enter a valid email address");
    expect(await User.countDocuments()).toBe(0);
  });

  it("turns an existing account into an active super admin and ends its sessions", async () => {
    const member = await createUser({ role: "manager", name: "Max Manager" });
    await signIn(member);
    await User.updateOne({ _id: member._id }, { status: "disabled" });

    const result = await createAdmin("--email", member.email);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("changed the role from manager to super_admin, re-enabled the account");
    const updated = await User.findById(member._id);
    expect(updated).toMatchObject({ role: "super_admin", status: "active", tokenVersion: member.tokenVersion + 1 });
    expect(await Session.countDocuments({ user: member._id, revokedAt: null })).toBe(0);

    // The account already has a password, so the link is a 1-hour reset.
    const verify = await anonymous().post("/api/auth/reset-password/verify").send({ token: linkToken(result.stdout) });
    expect(verify.body).toMatchObject({ purpose: "reset", email: member.email });
  });

  it("changes nothing for an active super admin but still issues a link", async () => {
    const admin = await createUser({ role: "super_admin" });

    const result = await createAdmin("--email", admin.email);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Nothing needed changing.");
    expect((await User.findById(admin._id)).tokenVersion).toBe(admin.tokenVersion);
    expect(await PasswordToken.countDocuments({ user: admin._id, purpose: "reset", usedAt: null })).toBe(1);
  });
});
