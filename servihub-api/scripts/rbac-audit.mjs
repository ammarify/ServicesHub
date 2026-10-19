// Calls every protected endpoint of a RUNNING API as all 4 roles plus an
// anonymous caller, and checks the permission gate against
// src/middleware/rbac.js (the single source of truth for who may do what).
//
// Every :id is a syntactically valid but nonexistent ObjectId (FAKE_ID) and
// bodies are either minimal or deliberately invalid, so a caller who clears
// the gate gets a harmless 400/404/409 - never a real change. Safe to run
// against a seeded database without re-seeding afterwards. A 401/403 means
// the gate stopped the request before the handler ran.
//
// tests/integration/rbac.test.js runs the same matrix in-process on every
// `npm test`; this script is for checking a live server (local or deployed).
//
// Usage: node scripts/rbac-audit.mjs [baseUrl]
// Needs the API running with DEMO_MODE on (it signs in through the demo
// login) and the seeded demo staff.

import { PERMISSIONS } from "../src/middleware/rbac.js";

const BASE_URL = (process.argv[2] ?? "http://localhost:5000").replace(/\/+$/, "");
const FAKE_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const ROLES = ["super_admin", "manager", "support_agent", "finance"];

// permission: null = any signed-in user (requireAuth only).
const ENDPOINTS = [
  { method: "GET", path: "/api/dashboard/summary", permission: "dashboard.read" },

  { method: "GET", path: "/api/bookings?limit=1", permission: "booking.read" },
  { method: "GET", path: `/api/bookings/${FAKE_ID}`, permission: "booking.read" },
  { method: "POST", path: "/api/bookings", permission: "booking.create", body: {} },
  { method: "PATCH", path: `/api/bookings/${FAKE_ID}`, permission: "booking.update", body: { address: "1 Nowhere Street" } },
  { method: "PATCH", path: `/api/bookings/${FAKE_ID}/status`, permission: "booking.update", body: { status: "completed" } },
  { method: "PATCH", path: `/api/bookings/${FAKE_ID}/reassign`, permission: "booking.reassign", body: { providerId: FAKE_ID } },
  { method: "PATCH", path: `/api/bookings/${FAKE_ID}/cancel`, permission: "booking.reassign", body: {} },

  { method: "GET", path: "/api/providers?limit=1", permission: "provider.read" },
  { method: "GET", path: `/api/providers/${FAKE_ID}`, permission: "provider.read" },
  { method: "POST", path: "/api/providers", permission: "provider.manage", body: {} },
  { method: "PATCH", path: `/api/providers/${FAKE_ID}`, permission: "provider.manage", body: { verified: true } },
  { method: "DELETE", path: `/api/providers/${FAKE_ID}`, permission: "provider.manage" },

  { method: "GET", path: "/api/customers?limit=1", permission: "customer.read" },
  { method: "GET", path: `/api/customers/${FAKE_ID}`, permission: "customer.read" },
  { method: "POST", path: "/api/customers", permission: "customer.manage", body: {} },
  { method: "PATCH", path: `/api/customers/${FAKE_ID}`, permission: "customer.manage", body: { area: "Hyde Park" } },
  { method: "DELETE", path: `/api/customers/${FAKE_ID}`, permission: "customer.manage" },

  { method: "GET", path: "/api/refunds?limit=1", permission: "refund.read" },
  { method: "GET", path: `/api/refunds/${FAKE_ID}`, permission: "refund.read" },
  { method: "POST", path: "/api/refunds", permission: "refund.request", body: { bookingId: FAKE_ID, amount: 1, reason: "audit" } },
  { method: "PATCH", path: `/api/refunds/${FAKE_ID}/decision`, permission: "refund.approve", body: { decision: "approved" } },

  { method: "GET", path: "/api/tickets?limit=1", permission: "ticket.read" },
  { method: "GET", path: `/api/tickets/${FAKE_ID}`, permission: "ticket.read" },
  { method: "POST", path: `/api/tickets/${FAKE_ID}/messages`, permission: "ticket.reply", body: { text: "audit" } },
  { method: "PATCH", path: `/api/tickets/${FAKE_ID}/status`, permission: "ticket.resolve", body: { status: "open" } },
  { method: "PATCH", path: `/api/tickets/${FAKE_ID}/priority`, permission: "ticket.resolve", body: { priority: "low" } },
  { method: "POST", path: `/api/tickets/${FAKE_ID}/analyze`, permission: "ticket.read" },

  { method: "GET", path: "/api/team", permission: "team.manage" },
  { method: "POST", path: "/api/team", permission: "team.manage", body: {} },
  { method: "POST", path: `/api/team/${FAKE_ID}/invite`, permission: "team.manage" },
  { method: "PATCH", path: `/api/team/${FAKE_ID}/role`, permission: "team.manage", body: { role: "manager" } },
  { method: "PATCH", path: `/api/team/${FAKE_ID}/status`, permission: "team.manage", body: { status: "active" } },
  { method: "DELETE", path: `/api/team/${FAKE_ID}`, permission: "team.manage" },

  { method: "GET", path: "/api/search?q=a", permission: null },
  { method: "GET", path: "/api/auth/me", permission: null },
  // Invalid bodies: anyone signed in reaches validation (400), nothing changes.
  { method: "PATCH", path: "/api/auth/me", permission: null, body: { name: "" } },
  { method: "POST", path: "/api/auth/change-password", permission: null, body: {} },
];

async function loginAs(role) {
  const res = await fetch(`${BASE_URL}/api/auth/demo-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (res.status === 404) {
    throw new Error("demo login is unavailable - start the API with DEMO_MODE=true (and seeded staff) to run this audit");
  }
  if (!res.ok) throw new Error(`demo-login failed for ${role}: ${res.status}`);
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter((pair) => !pair.endsWith("="))
    .join("; ");
}

async function call(cookie, { method, path, body }) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return res.status;
}

function passedGate(status) {
  return status !== 401 && status !== 403;
}

function allowedRoles(permission) {
  return permission === null ? ROLES : PERMISSIONS[permission];
}

async function main() {
  const untested = Object.keys(PERMISSIONS).filter((key) => !ENDPOINTS.some((e) => e.permission === key));
  if (untested.length > 0) {
    console.warn(`Warning: no endpoint in this audit exercises: ${untested.join(", ")}\n`);
  }

  const cookies = { unauthenticated: null };
  for (const role of ROLES) {
    cookies[role] = await loginAs(role);
  }

  const identities = ["unauthenticated", ...ROLES];
  const rows = [];
  let mismatchCount = 0;

  for (const endpoint of ENDPOINTS) {
    const row = { endpoint: `${endpoint.method} ${endpoint.path}` };
    for (const identity of identities) {
      const status = await call(cookies[identity], endpoint);
      const gatePassed = passedGate(status);
      const shouldPass = identity !== "unauthenticated" && allowedRoles(endpoint.permission).includes(identity);
      const mismatch = gatePassed !== shouldPass;
      if (mismatch) mismatchCount += 1;
      row[identity] = { status, gatePassed, mismatch };
    }
    rows.push(row);
  }

  const col = (s, w) => String(s).padEnd(w);
  const widths = { endpoint: 50, identity: 17 };

  console.log(col("ENDPOINT", widths.endpoint) + identities.map((i) => col(i.toUpperCase(), widths.identity)).join(""));
  console.log("-".repeat(widths.endpoint + widths.identity * identities.length));

  for (const row of rows) {
    const cells = identities
      .map((identity) => {
        const cell = row[identity];
        const mark = cell.mismatch ? "!!" : cell.gatePassed ? "OK" : "--";
        return col(`${mark} (${cell.status})`, widths.identity);
      })
      .join("");
    console.log(col(row.endpoint.slice(0, widths.endpoint - 1), widths.endpoint) + cells);
  }

  console.log("\nOK = passed the permission gate, -- = blocked (401/403), !! = mismatch vs rbac.js\n");

  if (mismatchCount === 0) {
    console.log(`PASS: all ${rows.length} endpoints x ${identities.length} identities matched rbac.js.`);
  } else {
    console.log(`FAIL: ${mismatchCount} mismatch(es) found - see !! markers above.`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("RBAC audit failed to run:", err.message);
  process.exitCode = 1;
});
