import { AxiosError } from "axios";
import { api } from "../lib/api";

const REPLY = Symbol("reply");

// A non-200 answer from a mock route: `reply(404, { message: "..." })`.
export function reply(status, data) {
  return { [REPLY]: true, status, data };
}

function compile(pattern) {
  const [method, path] = pattern.split(" ");
  const keys = [];
  const source = path.replace(/:[^/]+/g, (match) => {
    keys.push(match.slice(1));
    return "([^/]+)";
  });
  return { method, regex: new RegExp(`^${source}$`), keys };
}

function parseBody(data) {
  if (typeof data !== "string") return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

// Replaces the shared axios instance's transport with an in-memory route
// table, so the real interceptors (silent refresh, session expiry) still run.
//
//   const server = mockApi({
//     "GET /auth/me": { user },
//     "POST /refunds": (req) => reply(400, { errors: { amount: "..." } }),
//   });
//   server.calls  -> every request made, in order
export function mockApi(routes = {}) {
  const table = Object.entries(routes).map(([pattern, handler]) => ({ ...compile(pattern), handler }));
  const calls = [];

  api.defaults.adapter = async (config) => {
    const method = config.method.toUpperCase();
    const request = { method, url: config.url, params: config.params ?? {}, body: parseBody(config.data) };
    calls.push(request);

    let result = reply(404, { code: "NOT_FOUND", message: `No mock for ${method} ${config.url}` });
    for (const route of table) {
      if (route.method !== method) continue;
      const match = route.regex.exec(config.url);
      if (!match) continue;
      request.pathParams = Object.fromEntries(route.keys.map((key, index) => [key, match[index + 1]]));
      const value = typeof route.handler === "function" ? await route.handler(request) : route.handler;
      result = value?.[REPLY] ? value : reply(200, value);
      break;
    }

    const response = { data: result.data, status: result.status, statusText: "", headers: {}, config, request: {} };
    if (result.status >= 200 && result.status < 300) return response;
    throw new AxiosError(
      `Request failed with status code ${result.status}`,
      result.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
      config,
      {},
      response
    );
  };

  return {
    calls,
    callsTo(method, url) {
      return calls.filter((call) => call.method === method && call.url === url);
    },
  };
}

export const TEST_CONFIG = {
  demoMode: false,
  googleClientId: null,
  aiEnabled: true,
  emailEnabled: false,
  services: ["AC Repair", "Deep Cleaning", "Plumbing", "Electrical", "Maid Service", "Pest Control"],
  timezone: "America/Chicago",
};

// Mirrors servihub-api/src/middleware/rbac.js for the roles tests sign in as.
const ROLE_PERMISSIONS = {
  super_admin: [
    "dashboard.read",
    "booking.read",
    "booking.create",
    "booking.update",
    "booking.reassign",
    "provider.read",
    "provider.manage",
    "customer.read",
    "customer.manage",
    "refund.read",
    "refund.request",
    "refund.approve",
    "ticket.read",
    "ticket.reply",
    "ticket.resolve",
    "team.manage",
  ],
  manager: [
    "dashboard.read",
    "booking.read",
    "booking.create",
    "booking.update",
    "booking.reassign",
    "provider.read",
    "provider.manage",
    "customer.read",
    "customer.manage",
    "refund.read",
    "refund.request",
    "refund.approve",
    "ticket.read",
    "ticket.reply",
    "ticket.resolve",
  ],
  support_agent: [
    "dashboard.read",
    "booking.read",
    "refund.read",
    "refund.request",
    "ticket.read",
    "ticket.reply",
    "ticket.resolve",
  ],
  finance: ["dashboard.read", "booking.read", "refund.read", "refund.request", "refund.approve"],
};

export function testUser(role = "support_agent", overrides = {}) {
  return {
    id: `user-${role}`,
    name: `Test ${role}`,
    email: `${role}@servihub.test`,
    role,
    status: "active",
    permissions: ROLE_PERMISSIONS[role],
    ...overrides,
  };
}
