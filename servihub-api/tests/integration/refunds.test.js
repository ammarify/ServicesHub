import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Booking, Refund } from "../../src/models/index.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";
import { createBooking, createTeam } from "../helpers/factories.js";
import { signIn } from "../helpers/http.js";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

let team;
let agent;
let finance;
let manager;

beforeEach(async () => {
  await clearTestDb();
  team = await createTeam();
  agent = await signIn(team.support_agent);
  finance = await signIn(team.finance);
  manager = await signIn(team.manager);
});

function requestRefund(session, booking, amount, reason = "Service issue") {
  return session.post("/api/refunds").send({ bookingId: booking._id, amount, reason });
}

describe("requesting refunds", () => {
  it("creates a pending refund with a generated code", async () => {
    const booking = await createBooking({ amount: 200 });
    const res = await requestRefund(agent, booking, 50);

    expect(res.status).toBe(201);
    expect(res.body.refund).toMatchObject({ status: "pending", amount: 50 });
    expect(res.body.refund.code).toMatch(/^RF-\d+$/);
    expect(res.body.refund.requestedBy.name).toBe(team.support_agent.name);
  });

  it("never lets refunds add up to more than the booking amount", async () => {
    const booking = await createBooking({ amount: 200 });

    expect((await requestRefund(agent, booking, 250)).status).toBe(400);

    const first = await requestRefund(agent, booking, 150);
    await finance.patch(`/api/refunds/${first.body.refund._id}/decision`).send({ decision: "approved" });

    const tooMuch = await requestRefund(agent, booking, 100);
    expect(tooMuch.status).toBe(400);
    expect(tooMuch.body.errors.amount).toMatch(/\$50\.00/);

    const rest = await requestRefund(agent, booking, 50);
    expect(rest.status).toBe(201);
    await finance.patch(`/api/refunds/${rest.body.refund._id}/decision`).send({ decision: "approved" });

    const afterFull = await requestRefund(agent, booking, 1);
    expect(afterFull.status).toBe(409);
    expect(afterFull.body.message).toMatch(/fully refunded/);
  });

  it("allows only one pending request per booking", async () => {
    const booking = await createBooking({ amount: 200 });
    expect((await requestRefund(agent, booking, 20)).status).toBe(201);
    expect((await requestRefund(agent, booking, 20)).status).toBe(409);
  });

  it("holds up when two requests for the same booking arrive together", async () => {
    const booking = await createBooking({ amount: 200 });
    const results = await Promise.all([requestRefund(agent, booking, 20), requestRefund(manager, booking, 30)]);
    const statuses = results.map((res) => res.status).sort();
    expect(statuses).toEqual([201, 409]);
    expect(await Refund.countDocuments({ booking: booking._id, status: "pending" })).toBe(1);
  });

  it("frees the booking up again after a rejection", async () => {
    const booking = await createBooking({ amount: 200 });
    const first = await requestRefund(agent, booking, 200);
    await finance.patch(`/api/refunds/${first.body.refund._id}/decision`).send({ decision: "rejected" });
    expect((await requestRefund(agent, booking, 200)).status).toBe(201);
  });
});

describe("deciding refunds", () => {
  it("lets approvers decide once", async () => {
    const booking = await createBooking({ amount: 200 });
    const { body } = await requestRefund(agent, booking, 80);

    const denied = await agent.patch(`/api/refunds/${body.refund._id}/decision`).send({ decision: "approved" });
    expect(denied.status).toBe(403);

    const approved = await finance
      .patch(`/api/refunds/${body.refund._id}/decision`)
      .send({ decision: "approved", note: "Checked the photos" });
    expect(approved.status).toBe(200);
    expect(approved.body.refund).toMatchObject({ status: "approved", decisionNote: "Checked the photos" });
    expect(approved.body.refund.decidedBy.name).toBe(team.finance.name);

    const again = await manager.patch(`/api/refunds/${body.refund._id}/decision`).send({ decision: "rejected" });
    expect(again.status).toBe(409);
  });

  it("only one of two simultaneous decisions wins", async () => {
    const booking = await createBooking({ amount: 200 });
    const { body } = await requestRefund(agent, booking, 80);
    const results = await Promise.all([
      finance.patch(`/api/refunds/${body.refund._id}/decision`).send({ decision: "approved" }),
      manager.patch(`/api/refunds/${body.refund._id}/decision`).send({ decision: "rejected" }),
    ]);
    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
  });

  it("re-checks the refundable balance at approval time", async () => {
    const booking = await createBooking({ amount: 200 });
    const { body } = await requestRefund(agent, booking, 150);
    // The booking amount changed after the request was filed.
    await Booking.updateOne({ _id: booking._id }, { $set: { amount: 100 } });

    const res = await finance.patch(`/api/refunds/${body.refund._id}/decision`).send({ decision: "approved" });
    expect(res.status).toBe(409);
  });
});

describe("listing refunds", () => {
  it("filters by status and booking and returns counts", async () => {
    const a = await createBooking({ amount: 200 });
    const b = await createBooking({ amount: 200 });
    const first = await requestRefund(agent, a, 20);
    await finance.patch(`/api/refunds/${first.body.refund._id}/decision`).send({ decision: "approved" });
    await requestRefund(agent, a, 20);
    await requestRefund(agent, b, 20);

    const pending = await finance.get("/api/refunds?status=pending");
    expect(pending.body.total).toBe(2);
    expect(pending.body.counts).toEqual({ pending: 2, approved: 1, rejected: 0 });

    const forA = await finance.get(`/api/refunds?bookingId=${a._id}`);
    expect(forA.body.total).toBe(2);
    expect(forA.body.counts).toEqual({ pending: 1, approved: 1, rejected: 0 });
  });
});
