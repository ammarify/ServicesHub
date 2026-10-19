// Creates the first super admin on a database without demo data (a new
// production deployment), or makes an existing account an active super admin
// again (e.g. after a lock-out). Instead of taking a password on the command
// line it prints a single-use link for choosing one in the admin app.
//
// Usage (reads the same .env as the API - MONGODB_URI, CLIENT_URL, ...):
//   npm run create-admin -- --email you@company.com --name "Your Name"
//   npm run create-admin -- --email someone@company.com   (existing account)
//
// The link opens <first CLIENT_URL>/reset-password (or
// RESET_PASSWORD_URL_BASE). It is an invitation (valid 7 days) for an account
// that has never signed in, otherwise a password reset (valid 1 hour).

import crypto from "node:crypto";
import { parseArgs } from "node:util";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { z } from "zod";
import { env } from "../src/config/env.js";
import { BCRYPT_ROUNDS } from "../src/controllers/auth.controller.js";
import { User } from "../src/models/index.js";
import { buildPasswordLink, createPasswordToken } from "../src/services/passwordToken.service.js";
import { endAllSessions } from "../src/services/session.service.js";
import { emailSchema, personNameSchema } from "../src/validators/common.js";

const USAGE = 'Usage: npm run create-admin -- --email you@company.com [--name "Your Name"]';

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

let args;
try {
  ({ values: args } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  }));
} catch (err) {
  fail(`${err.message}\n${USAGE}`);
}

if (args.help) {
  console.log(USAGE);
  process.exit(0);
}

const parsed = z
  .object({ email: emailSchema, name: personNameSchema.optional() })
  .safeParse({ email: args.email ?? "", name: args.name });
if (!parsed.success) {
  fail(`${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n")}\n${USAGE}`);
}
const { email, name } = parsed.data;

await mongoose.connect(env.MONGODB_URI);

try {
  let user = await User.findOne({ email });
  const changes = [];

  if (!user) {
    if (!name) {
      fail(`No account uses ${email} yet, so --name is required to create it.\n${USAGE}`);
    }
    user = await User.create({
      name,
      email,
      role: "super_admin",
      status: "active",
      // Unusable until the password is chosen through the link.
      passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), BCRYPT_ROUNDS),
      passwordSetAt: null,
    });
    changes.push("created the account");
  } else {
    if (user.role !== "super_admin") {
      changes.push(`changed the role from ${user.role} to super_admin`);
      user.role = "super_admin";
    }
    if (user.status !== "active") {
      changes.push("re-enabled the account");
      user.status = "active";
    }
    if (name && name !== user.name) {
      changes.push(`renamed it from "${user.name}" to "${name}"`);
      user.name = name;
    }
    await user.save();
    if (changes.length > 0) {
      // Like a role change in Settings -> Team: every open session of the
      // account ends, so the next sign-in gets the new access. A running API
      // notices within a minute (its auth cache lives in that process).
      await endAllSessions(user._id, "create_admin_script");
    }
  }

  const neverSignedIn = !user.passwordSetAt && !user.lastLoginAt;
  const purpose = neverSignedIn ? "invite" : "reset";
  const { token, expiresAt } = await createPasswordToken(user._id, purpose);

  console.log(`\n${user.name} <${user.email}> is an active super admin.`);
  console.log(changes.length > 0 ? `Done: ${changes.join(", ")}.` : "Nothing needed changing.");
  console.log(
    `\nOpen this link to choose the password (single use, expires ${expiresAt.toISOString()}):\n${buildPasswordLink(token)}\n`
  );
  console.log("Anyone with the link can set the password, so share it only with that person.\n");
} finally {
  await mongoose.disconnect();
}
