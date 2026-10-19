import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";
import { createBooking, createProvider, createRefund, createTeam, createTicket } from "../helpers/factories.js";
import { signIn } from "../helpers/http.js";
import { addDaysInZone, dateKeyInZone, startOfDayInZone, startOfWeekInZone } from "../../src/utils/timezone.js";

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

let team;

beforeEach(async () => {
  await clearTestDb();
  team = await createTeam();
});

const TZ = "Asia/Karachi";
const HOUR = 60 * 60 * 1000;

describe("dashboard summary", () => {
  it("counts today's bookings in the viewer's time zone", async () => {
    const now = new Date();
    const todayStart = startOfDayInZone(now, TZ);
    const tomorrowStart = addDaysInZone(todayStart, 1, TZ);

    await createBooking({ scheduledAt: new Date(todayStart.getTime() + 1000), status: "completed", amount: 150 }); // just after local midnight
    await createBooking({ scheduledAt: new Date(tomorrowStart.getTime() - 1000) }); // just before the next one
    await createBooking({ scheduledAt: new Date(todayStart.getTime() - 1000) }); // yesterday, locally
    await createBooking({ scheduledAt: new Date(tomorrowStart.getTime() + HOUR) }); // tomorrow

    const manager = await signIn(team.manager);
    const res = await manager.get(`/api/dashboard/summary?range=today&tz=${encodeURIComponent(TZ)}`);

    expect(res.status).toBe(200);
    expect(res.body.timezone).toBe(TZ);
    expect(res.body.kpis.bookings).toBe(2);
    expect(res.body.kpis.bookingsDelta).toBe(100); // 2 vs 1 yesterday

    expect(res.body.trend).toHaveLength(7);
    const todayKey = dateKeyInZone(now, TZ);
    // Revenue per day counts completed jobs only, like the revenue KPI.
    expect(res.body.trend.at(-1)).toEqual({ date: todayKey, count: 2, revenue: 150 });
    expect(res.body.trend.at(-2).count).toBe(1);
  });

  it("uses calendar weeks starting on Monday and a 14-day chart", async () => {
    const now = new Date();
    const weekStart = startOfWeekInZone(now, TZ);
    await createBooking({ scheduledAt: new Date(weekStart.getTime() + HOUR) });
    await createBooking({ scheduledAt: new Date(weekStart.getTime() - HOUR) }); // last week

    const manager = await signIn(team.manager);
    const res = await manager.get(`/api/dashboard/summary?range=week&tz=${encodeURIComponent(TZ)}`);
    expect(res.body.kpis.bookings).toBe(1);
    expect(res.body.trend).toHaveLength(14);
    expect(new Date(res.body.period.start).toISOString()).toBe(weekStart.toISOString());
  });

  it("only counts completed bookings as revenue", async () => {
    const now = new Date();
    const earlierToday = new Date(Math.max(startOfDayInZone(now, TZ).getTime(), now.getTime() - HOUR));
    await createBooking({ status: "completed", amount: 300, scheduledAt: earlierToday });
    await createBooking({ status: "cancelled", amount: 999, scheduledAt: earlierToday });

    const manager = await signIn(team.manager);
    const res = await manager.get(`/api/dashboard/summary?range=month&tz=${encodeURIComponent(TZ)}`);
    expect(res.body.kpis.revenue).toBe(300);
    expect(res.body.trend).toHaveLength(30);
  });

  it("falls back to the business time zone for an invalid tz", async () => {
    const manager = await signIn(team.manager);
    const res = await manager.get("/api/dashboard/summary?tz=Not/AZone");
    expect(res.status).toBe(200);
    expect(res.body.timezone).toBe("America/Chicago");
  });

  it("only includes ticket figures for roles that can read tickets", async () => {
    await createTicket({ status: "open" });
    const booking = await createBooking();
    await createRefund({ booking: booking._id, requestedBy: team.support_agent._id, amount: 25 });
    await createProvider({ isAvailable: true });
    await createProvider({ isAvailable: false });

    const support = await (await signIn(team.support_agent)).get("/api/dashboard/summary");
    expect(support.body.kpis.activeTickets).toBe(1);
    expect(support.body.openTickets).toHaveLength(1);
    expect(support.body.openTickets[0].customer.name).toEqual(expect.any(String));
    expect(support.body.pendingRefunds.count).toBe(1);

    const finance = await (await signIn(team.finance)).get("/api/dashboard/summary");
    expect(finance.body.kpis.activeTickets).toBeUndefined();
    expect(finance.body.openTickets).toBeUndefined();
    expect(finance.body.pendingRefunds).toMatchObject({ count: 1, total: 25 });
    expect(finance.body.kpis).toMatchObject({ availableProviders: 1, totalProviders: 2 });
  });

  it("validates the range", async () => {
    const manager = await signIn(team.manager);
    expect((await manager.get("/api/dashboard/summary?range=year")).status).toBe(400);
  });
});
