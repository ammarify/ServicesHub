import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ROLES } from "../../src/models/User.js";
import { PERMISSIONS } from "../../src/middleware/rbac.js";
import { connectTestDb, disconnectTestDb } from "../helpers/db.js";
import { createTeam } from "../helpers/factories.js";
import { anonymous, signIn } from "../helpers/http.js";

// Calls every protected route as each role (and anonymously) and checks the
// permission gate against middleware/rbac.js. Routes are called with a
// syntactically valid but non-existent id, so anyone who passes the gate
// gets a harmless 404/400/409 - never a real change. 401/403 means the gate
// stopped the request.
const FAKE_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

const ENDPOINTS = [
  { method: "get", path: "/api/dashboard/summary", permission: "dashboard.read" },

  { method: "get", path: "/api/bookings?limit=1", permission: "booking.read" },
  { method: "get", path: `/api/bookings/${FAKE_ID}`, permission: "booking.read" },
  { method: "post", path: "/api/bookings", permission: "booking.create", body: {} },
  { method: "patch", path: `/api/bookings/${FAKE_ID}`, permission: "booking.update", body: { address: "1 Nowhere Street" } },
  { method: "patch", path: `/api/bookings/${FAKE_ID}/status`, permission: "booking.update", body: { status: "completed" } },
  { method: "patch", path: `/api/bookings/${FAKE_ID}/reassign`, permission: "booking.reassign", body: { providerId: FAKE_ID } },
  { method: "patch", path: `/api/bookings/${FAKE_ID}/cancel`, permission: "booking.reassign" },

  { method: "get", path: "/api/providers?limit=1", permission: "provider.read" },
  { method: "get", path: `/api/providers/${FAKE_ID}`, permission: "provider.read" },
  { method: "post", path: "/api/providers", permission: "provider.manage", body: {} },
  { method: "patch", path: `/api/providers/${FAKE_ID}`, permission: "provider.manage", body: { verified: true } },
  { method: "delete", path: `/api/providers/${FAKE_ID}`, permission: "provider.manage" },

  { method: "get", path: "/api/customers?limit=1", permission: "customer.read" },
  { method: "get", path: `/api/customers/${FAKE_ID}`, permission: "customer.read" },
  { method: "post", path: "/api/customers", permission: "customer.manage", body: {} },
  { method: "patch", path: `/api/customers/${FAKE_ID}`, permission: "customer.manage", body: { area: "Hyde Park" } },
  { method: "delete", path: `/api/customers/${FAKE_ID}`, permission: "customer.manage" },

  { method: "get", path: "/api/refunds?limit=1", permission: "refund.read" },
  { method: "get", path: `/api/refunds/${FAKE_ID}`, permission: "refund.read" },
  { method: "post", path: "/api/refunds", permission: "refund.request", body: { bookingId: FAKE_ID, amount: 1, reason: "audit" } },
  { method: "patch", path: `/api/refunds/${FAKE_ID}/decision`, permission: "refund.approve", body: { decision: "approved" } },

  { method: "get", path: "/api/tickets?limit=1", permission: "ticket.read" },
  { method: "get", path: `/api/tickets/${FAKE_ID}`, permission: "ticket.read" },
  { method: "post", path: `/api/tickets/${FAKE_ID}/messages`, permission: "ticket.reply", body: { text: "audit" } },
  { method: "patch", path: `/api/tickets/${FAKE_ID}/status`, permission: "ticket.resolve", body: { status: "open" } },
  { method: "patch", path: `/api/tickets/${FAKE_ID}/priority`, permission: "ticket.resolve", body: { priority: "low" } },
  { method: "post", path: `/api/tickets/${FAKE_ID}/analyze`, permission: "ticket.read" },

  { method: "get", path: "/api/team", permission: "team.manage" },
  { method: "post", path: "/api/team", permission: "team.manage", body: {} },
  { method: "post", path: `/api/team/${FAKE_ID}/invite`, permission: "team.manage" },
  { method: "patch", path: `/api/team/${FAKE_ID}/role`, permission: "team.manage", body: { role: "manager" } },
  { method: "patch", path: `/api/team/${FAKE_ID}/status`, permission: "team.manage", body: { status: "active" } },
  { method: "delete", path: `/api/team/${FAKE_ID}`, permission: "team.manage" },

  { method: "get", path: "/api/search?q=a", permission: null },
  { method: "get", path: "/api/auth/me", permission: null },
];

const sessions = {};

beforeAll(async () => {
  await connectTestDb();
  const team = await createTeam();
  for (const role of ROLES) {
    sessions[role] = await signIn(team[role]);
  }
});
afterAll(disconnectTestDb);

function passedGate(status) {
  return status !== 401 && status !== 403;
}

describe("RBAC matrix", () => {
  it("covers every permission in rbac.js", () => {
    const tested = new Set(ENDPOINTS.map((endpoint) => endpoint.permission).filter(Boolean));
    expect([...tested].sort()).toEqual(Object.keys(PERMISSIONS).sort());
  });

  for (const endpoint of ENDPOINTS) {
    const label = `${endpoint.method.toUpperCase()} ${endpoint.path}`;

    it(`${label} rejects anonymous callers`, async () => {
      const req = anonymous()[endpoint.method](endpoint.path);
      const res = endpoint.body ? await req.send(endpoint.body) : await req;
      expect(res.status).toBe(401);
    });

    for (const role of ROLES) {
      const allowed = endpoint.permission === null || PERMISSIONS[endpoint.permission].includes(role);

      it(`${label} ${allowed ? "allows" : "denies"} ${role}`, async () => {
        const req = sessions[role][endpoint.method](endpoint.path);
        const res = endpoint.body ? await req.send(endpoint.body) : await req;
        expect(passedGate(res.status), `status ${res.status}: ${JSON.stringify(res.body)}`).toBe(allowed);
      });
    }
  }
});

describe("permissions sent to the admin app", () => {
  for (const role of ROLES) {
    it(`/auth/me lists exactly the ${role} permissions`, async () => {
      const res = await sessions[role].get("/api/auth/me");
      const expected = Object.keys(PERMISSIONS).filter((key) => PERMISSIONS[key].includes(role));
      expect(res.body.user.permissions).toEqual(expected);
    });
  }
});
