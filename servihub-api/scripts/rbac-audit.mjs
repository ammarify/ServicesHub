// Hits every protected endpoint as all 4 roles + unauthenticated, and
// prints the resulting matrix next to what middleware/rbac.js's
// PERMISSIONS map says should happen, flagging any mismatch.
//
// Mutating routes are deliberately called with a syntactically-valid but
// nonexistent ObjectId (FAKE_ID) as the :id param, and either no body or
// a minimal body. Any role that clears the permission gate then hits a
// safe 404 ("not found") or 400 (validation) - never a real mutation, so
// this script is safe to run against a real seeded database without a
// re-seed afterward. A 401/403 means the gate rejected the request
// before the handler (and therefore the DB) was ever touched.
//
// Usage: node scripts/rbac-audit.mjs [baseUrl]
// Requires the API to be running with seeded demo users (Demo@1234).

const BASE_URL = process.argv[2] ?? "http://localhost:5000";
const FAKE_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

const ROLES = ["super_admin", "manager", "support_agent", "finance"];

// Mirrors servihub-api/src/middleware/rbac.js's PERMISSIONS map exactly -
// this script's whole point is to catch drift between that map and what
// the routes actually enforce, so it does not import rbac.js directly.
const EXPECTED_PERMISSIONS = {
  "dashboard.read": ["super_admin", "manager", "support_agent", "finance"],
  "booking.read": ["super_admin", "manager", "support_agent", "finance"],
  "booking.reassign": ["super_admin", "manager"],
  "provider.read": ["super_admin", "manager", "support_agent"],
  "customer.read": ["super_admin", "manager"],
  "refund.read": ["super_admin", "manager", "support_agent", "finance"],
  "refund.request": ["super_admin", "manager", "support_agent", "finance"],
  "refund.approve": ["super_admin", "manager", "finance"],
  "ticket.read": ["super_admin", "manager", "support_agent"],
  "ticket.reply": ["super_admin", "manager", "support_agent"],
  "ticket.resolve": ["super_admin", "manager", "support_agent"],
  "team.manage": ["super_admin"],
  // Not in rbac.js's PERMISSIONS map: gated by requireAuth only, so every
  // authenticated role is expected to pass regardless of role.
  "authenticated-only": ROLES,
};

const ENDPOINTS = [
  { method: "GET", path: "/api/dashboard/summary", permission: "dashboard.read" },

  { method: "GET", path: "/api/bookings?limit=1", permission: "booking.read" },
  { method: "GET", path: `/api/bookings/${FAKE_ID}`, permission: "booking.read" },
  { method: "PATCH", path: `/api/bookings/${FAKE_ID}/reassign`, permission: "booking.reassign", body: {} },
  { method: "PATCH", path: `/api/bookings/${FAKE_ID}/cancel`, permission: "booking.reassign" },

  { method: "GET", path: "/api/providers?limit=1", permission: "provider.read" },
  { method: "GET", path: `/api/providers/${FAKE_ID}`, permission: "provider.read" },

  { method: "GET", path: "/api/customers?limit=1", permission: "customer.read" },
  { method: "GET", path: `/api/customers/${FAKE_ID}`, permission: "customer.read" },

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
  { method: "PATCH", path: `/api/team/${FAKE_ID}/role`, permission: "team.manage", body: { role: "manager" } },
  { method: "PATCH", path: `/api/team/${FAKE_ID}/status`, permission: "team.manage", body: { status: "active" } },

  { method: "GET", path: "/api/search?q=a", permission: "authenticated-only" },
  { method: "GET", path: "/api/auth/me", permission: "authenticated-only" },
];

async function loginAs(role) {
  const res = await fetch(`${BASE_URL}/api/auth/demo-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error(`demo-login failed for ${role}: ${res.status}`);
  const setCookie = res.headers.getSetCookie?.() ?? res.headers.raw?.()["set-cookie"] ?? [];
  return setCookie.map((c) => c.split(";")[0]).join("; ");
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

async function main() {
  const cookies = { unauthenticated: null };
  for (const role of ROLES) {
    cookies[role] = await loginAs(role);
  }

  const identities = ["unauthenticated", ...ROLES];
  const rows = [];
  let mismatchCount = 0;

  for (const endpoint of ENDPOINTS) {
    const expectedAllowed = EXPECTED_PERMISSIONS[endpoint.permission] ?? [];
    const row = { endpoint: `${endpoint.method} ${endpoint.path}`, permission: endpoint.permission };

    for (const identity of identities) {
      const status = await call(cookies[identity], endpoint);
      const gatePassed = passedGate(status);
      const shouldPass = identity !== "unauthenticated" && expectedAllowed.includes(identity);
      const mismatch = gatePassed !== shouldPass;
      if (mismatch) mismatchCount += 1;
      row[identity] = { status, gatePassed, shouldPass, mismatch };
    }
    rows.push(row);
  }

  const col = (s, w) => String(s).padEnd(w);
  const widths = { endpoint: 42, identity: 15 };

  console.log(
    col("ENDPOINT", widths.endpoint) +
      identities.map((i) => col(i.toUpperCase(), widths.identity)).join("")
  );
  console.log("-".repeat(widths.endpoint + widths.identity * identities.length));

  for (const row of rows) {
    const cells = identities
      .map((identity) => {
        const cell = row[identity];
        const mark = cell.mismatch ? "!!" : cell.gatePassed ? "OK " : "-- ";
        return col(`${mark}(${cell.status})`, widths.identity);
      })
      .join("");
    console.log(col(row.endpoint, widths.endpoint) + cells);
  }

  console.log("\nOK = passed the permission gate, -- = blocked (401/403), !! = mismatch vs rbac.js\n");

  if (mismatchCount === 0) {
    console.log(`PASS: all ${rows.length} endpoints x ${identities.length} identities matched rbac.js exactly.`);
  } else {
    console.log(`FAIL: ${mismatchCount} mismatch(es) found - see !! markers above.`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("RBAC audit failed to run:", err);
  process.exitCode = 1;
});
