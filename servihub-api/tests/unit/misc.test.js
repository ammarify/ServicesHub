import { describe, expect, it } from "vitest";
import { parseDuration } from "../../src/utils/duration.js";
import { makeDateShifter, SEED_ANCHOR_DATE } from "../../src/seed/relativeDates.js";
import { PERMISSIONS, hasPermission, permissionsForRole } from "../../src/middleware/rbac.js";
import { passwordSchema } from "../../src/validators/common.js";
import { createBookingBodySchema } from "../../src/validators/booking.validators.js";

describe("parseDuration", () => {
  it("parses the supported units", () => {
    expect(parseDuration("30s")).toBe(30_000);
    expect(parseDuration("15m")).toBe(900_000);
    expect(parseDuration("12h")).toBe(43_200_000);
    expect(parseDuration("30d")).toBe(2_592_000_000);
  });

  it("rejects anything else", () => {
    expect(() => parseDuration("15 minutes")).toThrow();
  });
});

describe("seed date shifting", () => {
  it("moves the anchor day onto today and keeps the time of day", () => {
    const shift = makeDateShifter(new Date("2026-10-14T09:30:00Z"));
    expect(shift(`${SEED_ANCHOR_DATE}T13:00:00.000Z`).toISOString()).toBe("2026-10-14T13:00:00.000Z");
    expect(shift("2026-07-01T07:00:00.000Z").toISOString()).toBe("2026-10-04T07:00:00.000Z");
  });
});

describe("permissions", () => {
  it("gives super_admin every permission", () => {
    expect(permissionsForRole("super_admin")).toEqual(Object.keys(PERMISSIONS));
  });

  it("matches the documented matrix for the restricted roles", () => {
    expect(hasPermission("finance", "refund.approve")).toBe(true);
    expect(hasPermission("finance", "ticket.read")).toBe(false);
    expect(hasPermission("support_agent", "booking.reassign")).toBe(false);
    expect(hasPermission("support_agent", "provider.read")).toBe(false);
    expect(hasPermission("manager", "team.manage")).toBe(false);
  });

  it("returns nothing for unknown roles or permissions", () => {
    expect(permissionsForRole("intern")).toEqual([]);
    expect(hasPermission("super_admin", "rocket.launch")).toBe(false);
  });
});

describe("validators", () => {
  it("requires passwords with letters and numbers", () => {
    expect(passwordSchema.safeParse("short1").success).toBe(false);
    expect(passwordSchema.safeParse("onlyletters").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
    expect(passwordSchema.safeParse("Better1234").success).toBe(true);
  });

  it("rounds booking amounts to cents and rejects fractions of a cent", () => {
    const base = {
      customerId: "64b7f0c2a1b2c3d4e5f60718",
      service: "Plumbing",
      scheduledAt: "2026-10-20T10:00:00.000Z",
      address: "1 Test Street",
    };
    expect(createBookingBodySchema.parse({ ...base, amount: "19.99" }).amount).toBe(19.99);
    expect(createBookingBodySchema.safeParse({ ...base, amount: 19.999 }).success).toBe(false);
    expect(createBookingBodySchema.safeParse({ ...base, amount: 0 }).success).toBe(false);
    expect(createBookingBodySchema.safeParse({ ...base, amount: 50, service: "Gardening" }).success).toBe(false);
  });
});
