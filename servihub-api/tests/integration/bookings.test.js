import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Booking, Provider, Refund } from "../../src/models/index.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";
import { createBooking, createCustomer, createProvider, createTeam } from "../helpers/factories.js";
import { signIn } from "../helpers/http.js";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

let team;
let manager;
let agent;
let finance;

beforeEach(async () => {
  await clearTestDb();
  team = await createTeam();
  manager = await signIn(team.manager);
  agent = await signIn(team.support_agent);
  finance = await signIn(team.finance);
});

const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

describe("listing", () => {
  it("filters, searches and paginates", async () => {
    const jane = await createCustomer({ name: "Jane Searchable" });
    await createBooking({ customer: jane._id, service: "Plumbing", status: "completed" });
    await createBooking({ service: "Electrical", status: "pending" });
    await createBooking({ service: "Plumbing", status: "pending" });

    const byStatus = await finance.get("/api/bookings?status=pending");
    expect(byStatus.body.total).toBe(2);

    const byService = await finance.get("/api/bookings?service=Plumbing");
    expect(byService.body.items.every((b) => b.service === "Plumbing")).toBe(true);

    const bySearch = await finance.get("/api/bookings?search=searchable");
    expect(bySearch.body.items).toHaveLength(1);
    expect(bySearch.body.items[0].customer.name).toBe("Jane Searchable");

    const byCustomer = await finance.get(`/api/bookings?customerId=${jane._id}`);
    expect(byCustomer.body.total).toBe(1);

    const page1 = await finance.get("/api/bookings?limit=2&page=1");
    const page2 = await finance.get("/api/bookings?limit=2&page=2");
    expect(page1.body).toMatchObject({ total: 3, pages: 2 });
    const ids = [...page1.body.items, ...page2.body.items].map((b) => b._id);
    expect(new Set(ids).size).toBe(3);
  });

  it("rejects unknown services", async () => {
    const res = await finance.get("/api/bookings?service=Gardening");
    expect(res.status).toBe(400);
  });

  it("returns the provider's name, or null for an unassigned booking", async () => {
    const provider = await createProvider({ name: "Listed Provider" });
    const assigned = await createBooking({ provider: provider._id, status: "assigned" });
    const unassigned = await createBooking({ status: "pending" });

    const res = await finance.get("/api/bookings");
    const byId = Object.fromEntries(res.body.items.map((b) => [b._id, b]));
    expect(byId[assigned._id.toString()].provider).toMatchObject({ name: "Listed Provider" });
    expect(byId[unassigned._id.toString()].provider).toBeNull();
  });
});

describe("detail", () => {
  it("includes the customer, provider and refund summary for every role", async () => {
    const provider = await createProvider();
    const booking = await createBooking({ provider: provider._id, status: "completed", amount: 300 });
    await Refund.create({
      code: "RF-1",
      booking: booking._id,
      amount: 100,
      reason: "x",
      status: "approved",
      requestedBy: team.support_agent._id,
    });

    // Finance and support can't open customer profiles, but the booking
    // response itself carries what the booking page needs.
    for (const session of [finance, agent]) {
      const res = await session.get(`/api/bookings/${booking._id}`);
      expect(res.status).toBe(200);
      expect(res.body.booking.customer).toMatchObject({ name: expect.any(String), phone: expect.any(String) });
      expect(res.body.booking.provider.name).toBe(provider.name);
      expect(res.body.booking.refundSummary).toEqual({ approvedTotal: 100, pendingTotal: 0, refundable: 200 });
      expect(res.body.booking.refunds).toHaveLength(1);
    }
  });
});

describe("creating", () => {
  it("creates a pending booking without a provider", async () => {
    const customer = await createCustomer();
    const res = await manager.post("/api/bookings").send({
      customerId: customer._id,
      service: "Deep Cleaning",
      scheduledAt: tomorrow(),
      amount: 249.5,
      address: "12 Oak Street, Austin, TX",
    });

    expect(res.status).toBe(201);
    expect(res.body.booking).toMatchObject({ status: "pending", amount: 249.5, service: "Deep Cleaning" });
    expect(res.body.booking.code).toMatch(/^BK-\d+$/);
    expect(res.body.booking.timeline.map((t) => t.event)).toEqual(["created"]);
    expect(res.body.booking.timeline[0].actor).toBe(team.manager.name);
  });

  it("assigns a provider on creation when one is chosen", async () => {
    const customer = await createCustomer();
    const provider = await createProvider({ services: ["AC Repair"] });
    const res = await manager.post("/api/bookings").send({
      customerId: customer._id,
      service: "AC Repair",
      scheduledAt: tomorrow(),
      amount: 120,
      address: "12 Oak Street, Austin, TX",
      providerId: provider._id,
    });

    expect(res.status).toBe(201);
    expect(res.body.booking.status).toBe("assigned");
    expect(res.body.booking.provider._id).toBe(provider._id.toString());
    expect(res.body.booking.timeline.map((t) => t.event)).toEqual(["created", "assigned"]);
  });

  it("refuses providers who don't offer the service or are unavailable", async () => {
    const customer = await createCustomer();
    const plumber = await createProvider({ services: ["Plumbing"] });
    const offDuty = await createProvider({ services: ["AC Repair"], isAvailable: false });
    const base = { customerId: customer._id, service: "AC Repair", scheduledAt: tomorrow(), amount: 100, address: "1 Main Street" };

    expect((await manager.post("/api/bookings").send({ ...base, providerId: plumber._id })).status).toBe(409);
    expect((await manager.post("/api/bookings").send({ ...base, providerId: offDuty._id })).status).toBe(409);
  });

  it("is limited to roles with booking.create", async () => {
    const customer = await createCustomer();
    const res = await agent.post("/api/bookings").send({
      customerId: customer._id,
      service: "Plumbing",
      scheduledAt: tomorrow(),
      amount: 100,
      address: "1 Main Street",
    });
    expect(res.status).toBe(403);
  });

  it("generates unique codes under concurrent creates", async () => {
    const customer = await createCustomer();
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        manager.post("/api/bookings").send({
          customerId: customer._id,
          service: "Plumbing",
          scheduledAt: tomorrow(),
          amount: 100,
          address: "1 Main Street",
        })
      )
    );
    expect(results.every((res) => res.status === 201)).toBe(true);
    const codes = results.map((res) => res.body.booking.code);
    expect(new Set(codes).size).toBe(8);
  });
});

describe("reassigning", () => {
  it("assigns a pending booking and moves it to assigned", async () => {
    const provider = await createProvider({ services: ["Plumbing"] });
    const booking = await createBooking({ status: "pending" });

    const res = await manager.patch(`/api/bookings/${booking._id}/reassign`).send({ providerId: provider._id });
    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe("assigned");
    expect(res.body.booking.provider._id).toBe(provider._id.toString());
    expect(res.body.booking.timeline.at(-1)).toMatchObject({ event: "assigned", actor: team.manager.name });
  });

  it("records a reassignment between providers", async () => {
    const first = await createProvider({ services: ["Plumbing"] });
    const second = await createProvider({ services: ["Plumbing"], name: "Second Plumber" });
    const booking = await createBooking({ status: "assigned", provider: first._id });

    const res = await manager.patch(`/api/bookings/${booking._id}/reassign`).send({ providerId: second._id });
    expect(res.status).toBe(200);
    expect(res.body.booking.timeline.at(-1)).toMatchObject({
      event: "reassigned",
      note: "Provider reassigned to Second Plumber",
    });
  });

  it("rejects providers who don't offer the booking's service", async () => {
    const electrician = await createProvider({ services: ["Electrical"] });
    const booking = await createBooking({ service: "Plumbing" });
    const res = await manager.patch(`/api/bookings/${booking._id}/reassign`).send({ providerId: electrician._id });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/doesn't offer Plumbing/);
  });

  it("rejects closed bookings and the provider already assigned", async () => {
    const provider = await createProvider();
    const other = await createProvider();
    const cancelled = await createBooking({ status: "cancelled" });
    const completed = await createBooking({ status: "completed", provider: provider._id });
    const assigned = await createBooking({ status: "assigned", provider: provider._id });

    expect((await manager.patch(`/api/bookings/${cancelled._id}/reassign`).send({ providerId: other._id })).status).toBe(409);
    expect((await manager.patch(`/api/bookings/${completed._id}/reassign`).send({ providerId: other._id })).status).toBe(409);
    expect((await manager.patch(`/api/bookings/${assigned._id}/reassign`).send({ providerId: provider._id })).status).toBe(409);
  });
});

describe("lifecycle", () => {
  it("moves assigned -> in_progress -> completed and credits the provider", async () => {
    const provider = await createProvider({ jobsCompleted: 3 });
    const booking = await createBooking({ status: "assigned", provider: provider._id });

    const started = await manager.patch(`/api/bookings/${booking._id}/status`).send({ status: "in_progress" });
    expect(started.status).toBe(200);
    expect(started.body.booking.status).toBe("in_progress");

    const completed = await manager.patch(`/api/bookings/${booking._id}/status`).send({ status: "completed" });
    expect(completed.status).toBe(200);
    expect(completed.body.booking.timeline.map((t) => t.event)).toEqual(["created", "started", "completed"]);
    expect((await Provider.findById(provider._id)).jobsCompleted).toBe(4);
  });

  it("refuses to skip steps", async () => {
    const booking = await createBooking({ status: "pending" });
    const res = await manager.patch(`/api/bookings/${booking._id}/status`).send({ status: "completed" });
    expect(res.status).toBe(409);
  });

  it("cancels open bookings only, keeping the reason", async () => {
    const pending = await createBooking({ status: "pending" });
    const inProgress = await createBooking({ status: "in_progress" });

    const ok = await manager.patch(`/api/bookings/${pending._id}/cancel`).send({ reason: "Customer moved out" });
    expect(ok.status).toBe(200);
    expect(ok.body.booking.timeline.at(-1)).toMatchObject({ event: "cancelled", note: "Customer moved out" });

    const noBody = await manager.patch(`/api/bookings/${inProgress._id}/cancel`);
    expect(noBody.status).toBe(409);
  });

  it("reschedules and edits open bookings", async () => {
    const booking = await createBooking({ status: "assigned", amount: 200 });
    const newTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    const res = await manager.patch(`/api/bookings/${booking._id}`).send({ scheduledAt: newTime, amount: 180 });
    expect(res.status).toBe(200);
    expect(new Date(res.body.booking.scheduledAt).toISOString()).toBe(newTime);
    expect(res.body.booking.amount).toBe(180);
    expect(res.body.booking.timeline.map((t) => t.event)).toEqual(["created", "rescheduled", "updated"]);
  });

  it("won't lower the amount below refunds already granted", async () => {
    const booking = await createBooking({ status: "assigned", amount: 200 });
    await Refund.create({
      code: "RF-2",
      booking: booking._id,
      amount: 150,
      reason: "x",
      status: "approved",
      requestedBy: team.support_agent._id,
    });
    const res = await manager.patch(`/api/bookings/${booking._id}`).send({ amount: 100 });
    expect(res.status).toBe(409);
    expect((await Booking.findById(booking._id)).amount).toBe(200);
  });

  it("won't edit a completed booking", async () => {
    const booking = await createBooking({ status: "completed" });
    const res = await manager.patch(`/api/bookings/${booking._id}`).send({ address: "2 New Street, Austin" });
    expect(res.status).toBe(409);
  });
});
