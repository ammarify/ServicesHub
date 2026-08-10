// Full end-to-end user-journey verification against a LIVE running API
// (`npm run dev` in another terminal) + a seeded database (`npm run
// seed`). Exercises the real HTTP surface exactly as the frontend would,
// asserting status codes and response shapes at each step, and prints a
// clean PASS/FAIL report.
//
// This performs real writes (a reassign, an agent message, an analyze
// call that hits Groq for real, a refund create+approve) - it is not
// side-effect-free like scripts/rbac-audit.mjs. Re-run `npm run seed`
// afterward if you want the demo data back to its pristine state.
//
// Usage: node scripts/e2e-journey.mjs [baseUrl]

const BASE_URL = process.argv[2] ?? "http://localhost:5000";
const ROLES = ["super_admin", "manager", "support_agent", "finance"];

const results = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function step(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, status: "PASS", detail });
    console.log(`  PASS  ${name}${detail ? "  -  " + detail : ""}`);
    return { ok: true, value: detail };
  } catch (err) {
    results.push({ name, status: "FAIL", detail: err.message });
    console.log(`  FAIL  ${name}  -  ${err.message}`);
    return { ok: false };
  }
}

function skip(name, reason) {
  results.push({ name, status: "SKIP", detail: reason });
  console.log(`  SKIP  ${name}  -  ${reason}`);
}

function cookieHeader(setCookieArray) {
  return setCookieArray.map((c) => c.split(";")[0]).join("; ");
}

async function api(method, path, { cookie, body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // no/invalid JSON body - json stays null
  }
  return { status: res.status, body: json, res };
}

async function demoLogin(role) {
  const res = await fetch(`${BASE_URL}/api/auth/demo-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  const body = await res.json();
  if (res.status !== 200) {
    throw new Error(`demo-login(${role}) failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return { cookie: cookieHeader(res.headers.getSetCookie?.() ?? []), user: body.user };
}

async function main() {
  console.log(`\nServiHub E2E journey against ${BASE_URL}\n`);
  const sessions = {};

  console.log("--- Step 1: demo-login as each of the 4 roles, then dashboard summary ---");
  for (const role of ROLES) {
    const login = await step(`demo-login as ${role}`, async () => {
      const { cookie, user } = await demoLogin(role);
      assert(user.role === role, `expected role "${role}", got "${user.role}"`);
      assert(typeof user.id === "string" && typeof user.email === "string", "malformed user shape");
      sessions[role] = cookie;
      return `logged in as ${user.email}`;
    });

    if (!login.ok) {
      skip(`GET /dashboard/summary as ${role}`, "login failed");
      continue;
    }

    await step(`GET /dashboard/summary as ${role}`, async () => {
      const { status, body } = await api("GET", "/api/dashboard/summary", { cookie: sessions[role] });
      assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(body)}`);
      assert(body.kpis && typeof body.kpis.todaysBookings === "number", "missing/malformed kpis");
      assert(Array.isArray(body.last14Days) && body.last14Days.length === 14, "malformed last14Days");
      assert(Array.isArray(body.statusBreakdown), "missing statusBreakdown");
      assert(Array.isArray(body.recentBookings), "missing recentBookings");
      assert(Array.isArray(body.openTickets), "missing openTickets");
      return `todaysBookings=${body.kpis.todaysBookings}, activeTickets=${body.kpis.activeTickets}`;
    });
  }

  if (!sessions.manager || !sessions.support_agent) {
    console.log("\nAborting: manager or support_agent session unavailable - cannot continue the journey.\n");
    printSummary();
    process.exitCode = 1;
    return;
  }

  console.log("\n--- Step 2: bookings list, filters, and detail (as manager) ---");
  let bookingSample;
  const listStep = await step("GET /bookings?limit=10 (manager)", async () => {
    const { status, body } = await api("GET", "/api/bookings?limit=10", { cookie: sessions.manager });
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(body.items) && body.items.length > 0, "no bookings returned");
    assert(typeof body.total === "number" && typeof body.pages === "number", "malformed pagination shape");
    bookingSample = body.items[0];
    return `total=${body.total}, page=${body.page}, pages=${body.pages}`;
  });

  if (listStep.ok) {
    await step(`GET /bookings?status=${bookingSample.status} (filter)`, async () => {
      const { status, body } = await api("GET", `/api/bookings?status=${bookingSample.status}&limit=50`, {
        cookie: sessions.manager,
      });
      assert(status === 200, `expected 200, got ${status}`);
      assert(body.items.length > 0, "filter returned zero results for a status we know exists");
      assert(body.items.every((b) => b.status === bookingSample.status), "filter leaked a non-matching status");
      return `${body.items.length} booking(s) with status=${bookingSample.status}`;
    });

    await step(`GET /bookings?service=${encodeURIComponent(bookingSample.service)} (filter)`, async () => {
      const { status, body } = await api(
        "GET",
        `/api/bookings?service=${encodeURIComponent(bookingSample.service)}&limit=50`,
        { cookie: sessions.manager }
      );
      assert(status === 200, `expected 200, got ${status}`);
      assert(body.items.every((b) => b.service === bookingSample.service), "filter leaked a non-matching service");
      return `${body.items.length} booking(s) for service=${bookingSample.service}`;
    });

    const searchTerm = bookingSample.code.slice(0, 4);
    await step(`GET /bookings?search=${searchTerm} (filter)`, async () => {
      const { status, body } = await api("GET", `/api/bookings?search=${searchTerm}&limit=50`, {
        cookie: sessions.manager,
      });
      assert(status === 200, `expected 200, got ${status}`);
      assert(
        body.items.some((b) => b._id === bookingSample._id),
        "search by code prefix didn't find the booking it was derived from"
      );
      return `${body.items.length} result(s) for search="${searchTerm}"`;
    });

    await step("GET /bookings/:id (detail)", async () => {
      const { status, body } = await api("GET", `/api/bookings/${bookingSample._id}`, { cookie: sessions.manager });
      assert(status === 200, `expected 200, got ${status}`);
      assert(body.booking._id === bookingSample._id, "detail id mismatch");
      assert(body.booking.customer && typeof body.booking.customer.name === "string", "customer not populated");
      return `code=${body.booking.code}, service=${body.booking.service}`;
    });
  } else {
    skip("booking filters + detail", "booking list step failed");
  }

  console.log("\n--- Step 3: reassign a booking (as manager) ---");
  let reassignBookingId = null;
  const findCandidate = await step("find a reassignable booking + an alternate available provider", async () => {
    const { body: bookingsBody } = await api("GET", "/api/bookings?limit=50", { cookie: sessions.manager });
    const candidates = bookingsBody.items.filter((b) => ["pending", "assigned"].includes(b.status));
    assert(candidates.length > 0, "no pending/assigned booking found in the first 50");

    // Not every service has more than one available provider in the seed
    // data (e.g. Pest Control has exactly 2, one of them unavailable) -
    // search across candidate bookings/services rather than committing to
    // the first one, since "no alternate for THIS specific service" isn't
    // a backend bug, just a data-scarcity dead end for that one service.
    const servicesTried = new Set();
    for (const candidate of candidates) {
      if (servicesTried.has(candidate.service)) continue;
      servicesTried.add(candidate.service);

      const { body: providersBody } = await api(
        "GET",
        `/api/providers?service=${encodeURIComponent(candidate.service)}&availableOnly=true&limit=50`,
        { cookie: sessions.manager }
      );
      const altProvider = providersBody.items.find((p) => p._id !== candidate.provider?._id);
      if (altProvider) {
        reassignBookingId = { bookingId: candidate._id, providerId: altProvider._id, providerName: altProvider.name };
        return `booking=${candidate.code} (${candidate.service}) -> provider=${altProvider.name}`;
      }
    }
    throw new Error(
      `no alternate available provider found across ${servicesTried.size} distinct service(s) tried (${[...servicesTried].join(", ")})`
    );
  });

  if (findCandidate.ok) {
    await step("PATCH /bookings/:id/reassign (manager) -> 200", async () => {
      const { status, body } = await api("PATCH", `/api/bookings/${reassignBookingId.bookingId}/reassign`, {
        cookie: sessions.manager,
        body: { providerId: reassignBookingId.providerId },
      });
      assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(body)}`);
      assert(body.booking.provider === reassignBookingId.providerId, "booking.provider was not updated");
      return `now assigned to ${reassignBookingId.providerName}`;
    });
  } else {
    skip("PATCH /bookings/:id/reassign", "no candidate booking/provider found");
  }

  console.log("\n--- Step 4-7: tickets list -> open ticket -> agent message -> AI analyze (manager) ---");
  let ticketSample = null;
  const ticketListStep = await step("GET /tickets?limit=20 (manager)", async () => {
    const { status, body } = await api("GET", "/api/tickets?limit=20", { cookie: sessions.manager });
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(body.items) && body.items.length > 0, "no tickets returned");
    ticketSample = body.items[0];
    return `total=${body.total}`;
  });

  let fullTicket = null;
  if (ticketListStep.ok) {
    const detailStep = await step("GET /tickets/:id (open ticket)", async () => {
      const { status, body } = await api("GET", `/api/tickets/${ticketSample._id}`, { cookie: sessions.manager });
      assert(status === 200, `expected 200, got ${status}`);
      assert(Array.isArray(body.ticket.messages), "messages missing/not an array");
      fullTicket = body.ticket;
      return `code=${fullTicket.code}, ${fullTicket.messages.length} existing message(s)`;
    });

    if (detailStep.ok) {
      await step("POST /tickets/:id/messages (post agent message)", async () => {
        const { status, body } = await api("POST", `/api/tickets/${fullTicket._id}/messages`, {
          cookie: sessions.manager,
          body: { text: "E2E journey verification message" },
        });
        assert(status === 201, `expected 201, got ${status}: ${JSON.stringify(body)}`);
        assert(body.message.from === "agent", `expected from="agent", got "${body.message.from}"`);
        assert(body.message.text === "E2E journey verification message", "message text mismatch");
        return `message posted from=${body.message.from}`;
      });

      await step("POST /tickets/:id/analyze (real Groq call)", async () => {
        const { status, body } = await api("POST", `/api/tickets/${fullTicket._id}/analyze`, {
          cookie: sessions.manager,
        });
        assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(body)}`);
        const a = body.aiAnalysis;
        assert(a && typeof a.summary === "string" && a.summary.length > 0, "missing/empty summary");
        assert(["calm", "neutral", "frustrated", "angry"].includes(a.sentiment), `bad sentiment "${a.sentiment}"`);
        assert(
          a.refundEligibility &&
            typeof a.refundEligibility.eligible === "boolean" &&
            typeof a.refundEligibility.percent === "number",
          "malformed refundEligibility"
        );
        assert(typeof a.suggestedReply === "string" && a.suggestedReply.length > 0, "missing suggestedReply");
        assert(
          Array.isArray(a.suggestedActions) && a.suggestedActions.length >= 1 && a.suggestedActions.length <= 3,
          "suggestedActions must have 1-3 entries"
        );
        assert(typeof a.analyzedAt === "string", "missing analyzedAt");
        return `sentiment=${a.sentiment}, refund=${a.refundEligibility.percent}%, actions=[${a.suggestedActions.join(",")}]`;
      });
    } else {
      skip("POST /tickets/:id/messages", "ticket detail step failed");
      skip("POST /tickets/:id/analyze", "ticket detail step failed");
    }
  } else {
    skip("ticket detail/message/analyze steps", "ticket list step failed");
  }

  console.log("\n--- Step 8-11: refund request (agent) -> approve gate -> approve (manager) -> re-approve conflict ---");
  let refundBookingId = null;
  let refundBookingCode = null;
  let refundAmount = null;
  const findRefundBooking = await step("find a booking with no existing pending refund", async () => {
    const [refundsRes, bookingsRes] = await Promise.all([
      api("GET", "/api/refunds?status=pending&limit=50", { cookie: sessions.support_agent }),
      api("GET", "/api/bookings?limit=50", { cookie: sessions.support_agent }),
    ]);
    const pendingBookingIds = new Set(refundsRes.body.items.map((r) => r.booking._id));
    const candidate = bookingsRes.body.items.find((b) => !pendingBookingIds.has(b._id) && b.amount > 0);
    assert(candidate, "every booking in the first 50 already has a pending refund");
    refundBookingId = candidate._id;
    refundBookingCode = candidate.code;
    refundAmount = Math.max(1, Math.ceil(candidate.amount * 0.1));
    return `booking=${candidate.code}, amount=${candidate.amount}, requesting refund of ${refundAmount}`;
  });

  let refundId = null;
  if (findRefundBooking.ok) {
    const createStep = await step("POST /refunds (support_agent) -> 201", async () => {
      const { status, body } = await api("POST", "/api/refunds", {
        cookie: sessions.support_agent,
        body: { bookingId: refundBookingId, amount: refundAmount, reason: "E2E journey test refund" },
      });
      assert(status === 201, `expected 201, got ${status}: ${JSON.stringify(body)}`);
      assert(body.refund.status === "pending", `expected status="pending", got "${body.refund.status}"`);
      refundId = body.refund._id;
      return `refund=${body.refund.code} for booking=${refundBookingCode}`;
    });

    if (createStep.ok) {
      await step("PATCH /refunds/:id/decision as support_agent -> 403", async () => {
        const { status, body } = await api("PATCH", `/api/refunds/${refundId}/decision`, {
          cookie: sessions.support_agent,
          body: { decision: "approved" },
        });
        assert(status === 403, `expected 403, got ${status}: ${JSON.stringify(body)}`);
        return body.message;
      });

      await step("PATCH /refunds/:id/decision as manager -> 200", async () => {
        const { status, body } = await api("PATCH", `/api/refunds/${refundId}/decision`, {
          cookie: sessions.manager,
          body: { decision: "approved" },
        });
        assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(body)}`);
        assert(body.refund.status === "approved", `expected status="approved", got "${body.refund.status}"`);
        return `refund ${body.refund.code} now approved`;
      });

      await step("PATCH /refunds/:id/decision again (manager) -> 409", async () => {
        const { status, body } = await api("PATCH", `/api/refunds/${refundId}/decision`, {
          cookie: sessions.manager,
          body: { decision: "approved" },
        });
        assert(status === 409, `expected 409, got ${status}: ${JSON.stringify(body)}`);
        return body.message;
      });
    } else {
      skip("approve-gate/approve/re-approve steps", "refund creation failed");
    }
  } else {
    skip("refund request/approve/re-approve steps", "no eligible booking found");
  }

  console.log("\n--- Step 12: logout ---");
  for (const role of ROLES) {
    if (!sessions[role]) {
      skip(`POST /auth/logout (${role})`, "no session (login failed earlier)");
      continue;
    }
    await step(`POST /auth/logout (${role})`, async () => {
      const { status, body, res } = await api("POST", "/api/auth/logout", { cookie: sessions[role] });
      assert(status === 200, `expected 200, got ${status}`);
      assert(body.message === "Logged out", `unexpected message: ${JSON.stringify(body)}`);
      const setCookies = res.headers.getSetCookie?.() ?? [];
      const clearedAccess = setCookies.find((c) => c.startsWith("accessToken="));
      assert(clearedAccess && /Expires=/.test(clearedAccess), "accessToken cookie was not cleared");
      return "cookies cleared";
    });
  }

  printSummary();
}

function printSummary() {
  const passCount = results.filter((r) => r.status === "PASS").length;
  const failCount = results.filter((r) => r.status === "FAIL").length;
  const skipCount = results.filter((r) => r.status === "SKIP").length;

  console.log("\n=========================================");
  console.log(`  ${passCount} passed, ${failCount} failed, ${skipCount} skipped (${results.length} total steps)`);
  console.log("=========================================\n");

  if (failCount > 0) {
    console.log("Failed steps:");
    for (const r of results.filter((r) => r.status === "FAIL")) {
      console.log(`  - ${r.name}: ${r.detail}`);
    }
    console.log("");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Journey script crashed:", err);
  process.exitCode = 1;
});
