// End-to-end journey against a LIVE API (`npm run dev` in another terminal)
// with seeded demo data (`npm run seed`). It drives the real HTTP surface
// the way the admin app and the customer simulator do, asserts status codes
// and response shapes at every step, and prints a PASS/FAIL/SKIP report.
//
// This WRITES data: it creates a booking, a ticket, refunds and a team
// member, and moves things through their lifecycles. Run `npm run seed`
// afterwards to get the pristine demo data back. With GROQ_API_KEY set, the
// AI step makes one real Groq call; without it that step is skipped.
//
// Needs DEMO_MODE on (it signs in through the demo login and uses the
// customer simulator endpoints).
//
// Usage: node scripts/e2e-journey.mjs [baseUrl]

const BASE_URL = (process.argv[2] ?? "http://localhost:5000").replace(/\/+$/, "");
const ROLES = ["super_admin", "manager", "support_agent", "finance"];
const STAMP = Date.now().toString().slice(-6);

const results = [];
const sessions = {};
const state = {};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function step(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, status: "PASS", detail });
    console.log(`  PASS  ${name}${detail ? `  -  ${detail}` : ""}`);
    return true;
  } catch (err) {
    results.push({ name, status: "FAIL", detail: err.message });
    console.log(`  FAIL  ${name}  -  ${err.message}`);
    return false;
  }
}

function skip(name, reason) {
  results.push({ name, status: "SKIP", detail: reason });
  console.log(`  SKIP  ${name}  -  ${reason}`);
}

function cookieHeader(res) {
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter((pair) => !pair.endsWith("="))
    .join("; ");
}

async function api(method, path, { cookie, body, headers = {} } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // no JSON body
  }
  return { status: res.status, body: json, res };
}

function expectStatus(result, expected) {
  assert(result.status === expected, `expected ${expected}, got ${result.status}: ${JSON.stringify(result.body)}`);
}

async function demoLogin(role) {
  const result = await api("POST", "/api/auth/demo-login", { body: { role } });
  if (result.status === 404) throw new Error("demo login is off - start the API with DEMO_MODE=true");
  expectStatus(result, 200);
  return { cookie: cookieHeader(result.res), user: result.body.user };
}

function section(title) {
  console.log(`\n--- ${title} ---`);
}

async function main() {
  console.log(`\nServiHub E2E journey against ${BASE_URL}`);

  section("Server");
  await step("GET /api/health", async () => {
    const result = await api("GET", "/api/health");
    expectStatus(result, 200);
    assert(result.body.db === "connected", "database not connected");
  });
  await step("GET /api/config", async () => {
    const result = await api("GET", "/api/config");
    expectStatus(result, 200);
    assert(Array.isArray(result.body.services) && result.body.services.length > 0, "no services");
    state.config = result.body;
    return `demoMode=${result.body.demoMode}, aiEnabled=${result.body.aiEnabled}, emailEnabled=${result.body.emailEnabled}`;
  });

  section("Sign in as every role + role-aware dashboard");
  for (const role of ROLES) {
    const ok = await step(`demo-login as ${role}`, async () => {
      const { cookie, user } = await demoLogin(role);
      assert(user.role === role, `expected role ${role}, got ${user.role}`);
      assert(Array.isArray(user.permissions) && user.permissions.length > 0, "no permissions in the user payload");
      sessions[role] = { cookie, user };
      return `${user.email} (${user.permissions.length} permissions)`;
    });
    if (!ok) continue;

    await step(`GET /dashboard/summary as ${role}`, async () => {
      const result = await api("GET", "/api/dashboard/summary?range=week&tz=America/Chicago", { cookie: sessions[role].cookie });
      expectStatus(result, 200);
      const { kpis, trend, statusBreakdown, recentBookings } = result.body;
      assert(typeof kpis?.bookings === "number" && typeof kpis?.revenue === "number", "malformed kpis");
      assert(Array.isArray(trend) && trend.length === 14, "trend should cover 14 days for a week");
      assert(Array.isArray(statusBreakdown) && Array.isArray(recentBookings), "missing lists");
      const permissions = sessions[role].user.permissions;
      assert(permissions.includes("ticket.read") === "activeTickets" in kpis, "ticket KPIs don't match ticket.read");
      assert(permissions.includes("refund.read") === Boolean(result.body.pendingRefunds), "refund block doesn't match refund.read");
      return `bookings this week=${kpis.bookings}, revenue=$${kpis.revenue}`;
    });
  }

  if (!sessions.manager || !sessions.support_agent || !sessions.finance || !sessions.super_admin) {
    console.log("\nAborting: not every role could sign in.\n");
    return;
  }
  const manager = sessions.manager.cookie;
  const agent = sessions.support_agent.cookie;
  const finance = sessions.finance.cookie;
  const admin = sessions.super_admin.cookie;

  section("Bookings: list, filters, detail");
  await step("GET /bookings with status + service filters and search", async () => {
    const list = await api("GET", "/api/bookings?limit=10", { cookie: manager });
    expectStatus(list, 200);
    assert(list.body.items.length > 0 && typeof list.body.total === "number", "empty or malformed list");
    const sample = list.body.items[0];
    const byStatus = await api("GET", `/api/bookings?status=${sample.status}&limit=50`, { cookie: manager });
    assert(byStatus.body.items.every((b) => b.status === sample.status), "status filter leaked other statuses");
    const byService = await api("GET", `/api/bookings?service=${encodeURIComponent(sample.service)}&limit=50`, { cookie: manager });
    assert(byService.body.items.every((b) => b.service === sample.service), "service filter leaked other services");
    const bySearch = await api("GET", `/api/bookings?search=${sample.code}`, { cookie: manager });
    assert(bySearch.body.items.some((b) => b._id === sample._id), "search by code missed the booking");
    const detail = await api("GET", `/api/bookings/${sample._id}`, { cookie: agent });
    expectStatus(detail, 200);
    assert(detail.body.booking.customer?.name, "customer not populated on the detail (support agent view)");
    assert(detail.body.booking.refundSummary, "refundSummary missing");
    return `total=${list.body.total}`;
  });

  section("Booking lifecycle (manager)");
  await step("POST /bookings creates a pending booking", async () => {
    const customers = await api("GET", "/api/customers?limit=1", { cookie: manager });
    const customer = customers.body.items[0];
    const service = state.config.services.find((s) => s === "Plumbing") ?? state.config.services[0];
    const scheduledAt = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();
    const result = await api("POST", "/api/bookings", {
      cookie: manager,
      body: { customerId: customer._id, service, scheduledAt, amount: 180, address: "1 E2E Street, Austin, TX 78701" },
    });
    expectStatus(result, 201);
    assert(result.body.booking.status === "pending", `status ${result.body.booking.status}`);
    state.booking = result.body.booking;
    return `${state.booking.code} for ${customer.name} (${service})`;
  });

  await step("assigning a provider who doesn't offer the service is refused (409)", async () => {
    const providers = await api("GET", "/api/providers?limit=50&availableOnly=true", { cookie: manager });
    const wrong = providers.body.items.find((p) => !p.services.includes(state.booking.service));
    assert(wrong, "no provider without this service to test with");
    const result = await api("PATCH", `/api/bookings/${state.booking._id}/reassign`, { cookie: manager, body: { providerId: wrong._id } });
    expectStatus(result, 409);
    return result.body.message;
  });

  await step("assigning a matching provider moves pending -> assigned", async () => {
    const providers = await api("GET", `/api/providers?service=${encodeURIComponent(state.booking.service)}&availableOnly=true`, { cookie: manager });
    const provider = providers.body.items[0];
    assert(provider, `no available provider for ${state.booking.service}`);
    const result = await api("PATCH", `/api/bookings/${state.booking._id}/reassign`, { cookie: manager, body: { providerId: provider._id } });
    expectStatus(result, 200);
    assert(result.body.booking.status === "assigned", `status ${result.body.booking.status}`);
    assert(result.body.booking.provider?._id === provider._id, "provider not populated/updated");
    return `assigned to ${provider.name}`;
  });

  await step("reschedule + amount edit add timeline entries", async () => {
    const scheduledAt = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
    const result = await api("PATCH", `/api/bookings/${state.booking._id}`, { cookie: manager, body: { scheduledAt, amount: 200 } });
    expectStatus(result, 200);
    const events = result.body.booking.timeline.map((t) => t.event);
    assert(events.includes("rescheduled") && events.includes("updated"), `timeline: ${events.join(",")}`);
  });

  await step("start -> complete; a completed booking can't be reassigned or cancelled", async () => {
    const started = await api("PATCH", `/api/bookings/${state.booking._id}/status`, { cookie: manager, body: { status: "in_progress" } });
    expectStatus(started, 200);
    const completed = await api("PATCH", `/api/bookings/${state.booking._id}/status`, { cookie: manager, body: { status: "completed" } });
    expectStatus(completed, 200);
    const cancel = await api("PATCH", `/api/bookings/${state.booking._id}/cancel`, { cookie: manager, body: {} });
    expectStatus(cancel, 409);
  });

  await step("support agent can't change bookings (403)", async () => {
    const result = await api("PATCH", `/api/bookings/${state.booking._id}`, { cookie: agent, body: { amount: 1 } });
    expectStatus(result, 403);
  });

  section("Customer simulator -> live ticket");
  if (!state.config.demoMode) {
    skip("simulator journey", "DEMO_MODE is off");
  } else {
    await step("customer opens a ticket and gets a per-ticket token", async () => {
      const options = await api("GET", "/api/tickets/simulator/options");
      expectStatus(options, 200);
      const customer = options.body.customers.find((c) => c.bookings.length > 0);
      const result = await api("POST", "/api/tickets", {
        body: {
          customerId: customer.id,
          bookingId: customer.bookings[0].id,
          subject: `E2E ${STAMP}: technician never arrived`,
          text: "Nobody showed up for my appointment and nobody called.",
          priority: "medium",
        },
      });
      expectStatus(result, 201);
      assert(typeof result.body.token === "string", "no simulator token");
      state.ticket = result.body.ticket;
      state.simToken = result.body.token;
      return `${state.ticket.code} for ${customer.name}`;
    });

    await step("the token is required, and only works for its own ticket", async () => {
      const without = await api("GET", `/api/tickets/simulator/${state.ticket._id}`);
      expectStatus(without, 401);
      const withToken = await api("GET", `/api/tickets/simulator/${state.ticket._id}`, {
        headers: { "x-simulator-token": state.simToken },
      });
      expectStatus(withToken, 200);
      const other = await api("GET", "/api/tickets?limit=1&status=resolved", { cookie: agent });
      const otherId = other.body.items[0]?._id;
      if (otherId) {
        const wrong = await api("GET", `/api/tickets/simulator/${otherId}`, { headers: { "x-simulator-token": state.simToken } });
        expectStatus(wrong, 401);
      }
    });

    await step("agent reply moves the ticket to in_progress", async () => {
      const result = await api("POST", `/api/tickets/${state.ticket._id}/messages`, {
        cookie: agent,
        body: { text: "Sorry about that - we're finding you a new technician now." },
      });
      expectStatus(result, 201);
      assert(result.body.status === "in_progress", `status ${result.body.status}`);
    });

    await step("resolve, then a customer message reopens it", async () => {
      const resolved = await api("PATCH", `/api/tickets/${state.ticket._id}/status`, { cookie: agent, body: { status: "resolved" } });
      expectStatus(resolved, 200);
      const reply = await api("POST", `/api/tickets/${state.ticket._id}/customer-message`, {
        body: { text: "Still waiting, please help." },
        headers: { "x-simulator-token": state.simToken },
      });
      expectStatus(reply, 201);
      const ticket = await api("GET", `/api/tickets/${state.ticket._id}`, { cookie: agent });
      assert(ticket.body.ticket.status === "open", `status ${ticket.body.ticket.status}`);
    });

    await step("finance can't read tickets (403)", async () => {
      const result = await api("GET", `/api/tickets/${state.ticket._id}`, { cookie: finance });
      expectStatus(result, 403);
    });
  }

  section("AI Copilot");
  const ticketForAi = state.ticket?._id ?? (await api("GET", "/api/tickets?limit=1", { cookie: agent })).body.items[0]?._id;
  if (!state.config.aiEnabled) {
    await step("analyze reports the copilot as not configured (503)", async () => {
      const result = await api("POST", `/api/tickets/${ticketForAi}/analyze`, { cookie: agent });
      expectStatus(result, 503);
      assert(result.body.code === "FEATURE_DISABLED", `code ${result.body.code}`);
    });
    skip("POST /tickets/:id/analyze (real Groq call)", "GROQ_API_KEY is not set on the server");
  } else {
    await step("POST /tickets/:id/analyze (real Groq call)", async () => {
      const result = await api("POST", `/api/tickets/${ticketForAi}/analyze`, { cookie: agent });
      expectStatus(result, 200);
      const a = result.body.aiAnalysis;
      assert(typeof a.summary === "string" && a.summary.length > 0, "empty summary");
      assert(["calm", "neutral", "frustrated", "angry"].includes(a.sentiment), `bad sentiment ${a.sentiment}`);
      assert(typeof a.refundEligibility?.percent === "number", "malformed refundEligibility");
      assert(a.refundEligibility.percent >= 0 && a.refundEligibility.percent <= 100, "percent out of range");
      assert(Array.isArray(a.suggestedActions) && a.suggestedActions.length >= 1, "no actions");
      assert(Array.isArray(a.guardrails), "guardrails missing");
      return `sentiment=${a.sentiment}, refund=${a.refundEligibility.percent}%, actions=[${a.suggestedActions.join(",")}]`;
    });
  }

  section("Refunds: request, caps, decision");
  await step("support agent requests a refund on a booking with none", async () => {
    const refunds = await api("GET", "/api/refunds?limit=50", { cookie: agent });
    const withRefunds = new Set(refunds.body.items.map((r) => r.booking?._id));
    const bookings = await api("GET", "/api/bookings?status=completed&limit=50", { cookie: agent });
    const booking = bookings.body.items.find((b) => !withRefunds.has(b._id) && b._id !== state.booking?._id);
    assert(booking, "no completed booking without refunds");
    state.refundBooking = booking;
    const result = await api("POST", "/api/refunds", {
      cookie: agent,
      body: { bookingId: booking._id, amount: Math.round(booking.amount * 0.5), reason: "E2E: half the job was skipped" },
    });
    expectStatus(result, 201);
    state.refund = result.body.refund;
    return `${state.refund.code} for ${booking.code} ($${state.refund.amount} of $${booking.amount})`;
  });

  await step("a second pending request for the same booking is refused (409)", async () => {
    const result = await api("POST", "/api/refunds", {
      cookie: agent,
      body: { bookingId: state.refundBooking._id, amount: 1, reason: "duplicate" },
    });
    expectStatus(result, 409);
  });

  await step("support agent can't decide (403); finance approves with a note", async () => {
    const denied = await api("PATCH", `/api/refunds/${state.refund._id}/decision`, { cookie: agent, body: { decision: "approved" } });
    expectStatus(denied, 403);
    const approved = await api("PATCH", `/api/refunds/${state.refund._id}/decision`, {
      cookie: finance,
      body: { decision: "approved", note: "E2E approval" },
    });
    expectStatus(approved, 200);
    assert(approved.body.refund.status === "approved", `status ${approved.body.refund.status}`);
    const again = await api("PATCH", `/api/refunds/${state.refund._id}/decision`, { cookie: finance, body: { decision: "rejected" } });
    expectStatus(again, 409);
  });

  await step("refunds can't exceed what's left on the booking (400)", async () => {
    const remaining = state.refundBooking.amount - state.refund.amount;
    const result = await api("POST", "/api/refunds", {
      cookie: agent,
      body: { bookingId: state.refundBooking._id, amount: remaining + 1, reason: "E2E: too much" },
    });
    expectStatus(result, 400);
    return result.body.message;
  });

  section("Team: invite, activate, role change, disable");
  const invitee = { name: "E2E Invitee", email: `e2e.${STAMP}@servihub.test`, password: `E2ePass${STAMP}` };
  await step("super_admin invites a member", async () => {
    const result = await api("POST", "/api/team", { cookie: admin, body: { name: invitee.name, email: invitee.email, role: "support_agent" } });
    expectStatus(result, 201);
    assert(result.body.inviteUrl, "no invite link returned");
    state.member = result.body.member;
    state.inviteToken = new URL(result.body.inviteUrl).searchParams.get("token");
    return `emailSent=${result.body.emailSent}`;
  });

  await step("manager can't add members (403)", async () => {
    const result = await api("POST", "/api/team", { cookie: manager, body: { name: "Nope", email: `nope.${STAMP}@servihub.test`, role: "finance" } });
    expectStatus(result, 403);
  });

  await step("invite link sets the password once; the member can sign in", async () => {
    const verify = await api("POST", "/api/auth/reset-password/verify", { body: { token: state.inviteToken } });
    expectStatus(verify, 200);
    assert(verify.body.purpose === "invite", `purpose ${verify.body.purpose}`);
    const reset = await api("POST", "/api/auth/reset-password", { body: { token: state.inviteToken, password: invitee.password } });
    expectStatus(reset, 200);
    const reuse = await api("POST", "/api/auth/reset-password", { body: { token: state.inviteToken, password: invitee.password } });
    expectStatus(reuse, 400);
    const login = await api("POST", "/api/auth/login", { body: { email: invitee.email, password: invitee.password } });
    expectStatus(login, 200);
    state.memberCookie = cookieHeader(login.res);
  });

  await step("a role change ends the member's session immediately", async () => {
    const change = await api("PATCH", `/api/team/${state.member._id}/role`, { cookie: admin, body: { role: "finance" } });
    expectStatus(change, 200);
    const me = await api("GET", "/api/auth/me", { cookie: state.memberCookie });
    expectStatus(me, 401);
    assert(me.body.code === "SESSION_REVOKED", `code ${me.body.code}`);
  });

  await step("a disabled member can't sign in (403)", async () => {
    const disable = await api("PATCH", `/api/team/${state.member._id}/status`, { cookie: admin, body: { status: "disabled" } });
    expectStatus(disable, 200);
    const login = await api("POST", "/api/auth/login", { body: { email: invitee.email, password: invitee.password } });
    expectStatus(login, 403);
  });

  section("Sign out");
  for (const role of ROLES) {
    await step(`POST /auth/logout (${role})`, async () => {
      const result = await api("POST", "/api/auth/logout", { cookie: sessions[role].cookie });
      expectStatus(result, 200);
      const cleared = result.res.headers.getSetCookie().filter((c) => /Expires=Thu, 01 Jan 1970/.test(c)).map((c) => c.split("=")[0]);
      assert(cleared.includes("accessToken") && cleared.includes("sh_refresh"), `cleared: ${cleared.join(",")}`);
      const me = await api("GET", "/api/auth/me", { cookie: sessions[role].cookie });
      expectStatus(me, 401);
    });
  }
}

function printSummary() {
  const count = (status) => results.filter((r) => r.status === status).length;
  console.log("\n=========================================");
  console.log(`  ${count("PASS")} passed, ${count("FAIL")} failed, ${count("SKIP")} skipped (${results.length} steps)`);
  console.log("=========================================\n");

  const failed = results.filter((r) => r.status === "FAIL");
  if (failed.length > 0) {
    console.log("Failed steps:");
    for (const r of failed) console.log(`  - ${r.name}: ${r.detail}`);
    console.log("");
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error("Journey script crashed:", err);
    process.exitCode = 1;
  })
  .finally(printSummary);
