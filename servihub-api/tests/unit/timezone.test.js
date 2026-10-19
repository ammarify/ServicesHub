import { describe, expect, it } from "vitest";
import {
  addDaysInZone,
  addMonthsInZone,
  dateKeyInZone,
  isValidTimeZone,
  startOfDayInZone,
  startOfMonthInZone,
  startOfWeekInZone,
} from "../../src/utils/timezone.js";

describe("timezone helpers", () => {
  it("finds the start of the local day, not the server's or UTC's", () => {
    const instant = new Date("2026-10-14T03:00:00.000Z"); // 22:00 on Oct 13 in Chicago, 08:00 Oct 14 in Karachi
    expect(startOfDayInZone(instant, "America/Chicago").toISOString()).toBe("2026-10-13T05:00:00.000Z");
    expect(startOfDayInZone(instant, "Asia/Karachi").toISOString()).toBe("2026-10-13T19:00:00.000Z");
    expect(dateKeyInZone(instant, "America/Chicago")).toBe("2026-10-13");
    expect(dateKeyInZone(instant, "Asia/Karachi")).toBe("2026-10-14");
  });

  it("handles days that are 23 or 25 hours long around DST changes", () => {
    const springForward = startOfDayInZone(new Date("2026-03-08T12:00:00Z"), "America/Chicago");
    expect(springForward.toISOString()).toBe("2026-03-08T06:00:00.000Z");
    expect(addDaysInZone(springForward, 1, "America/Chicago").toISOString()).toBe("2026-03-09T05:00:00.000Z");

    const fallBack = startOfDayInZone(new Date("2026-11-01T12:00:00Z"), "America/Chicago");
    expect(fallBack.toISOString()).toBe("2026-11-01T05:00:00.000Z");
    expect(addDaysInZone(fallBack, 1, "America/Chicago").toISOString()).toBe("2026-11-02T06:00:00.000Z");
  });

  it("starts weeks on Monday", () => {
    // Sunday 2026-03-08 belongs to the week starting Monday 2026-03-02.
    const start = startOfWeekInZone(new Date("2026-03-08T18:00:00Z"), "UTC");
    expect(start.toISOString()).toBe("2026-03-02T00:00:00.000Z");
  });

  it("computes month boundaries, including across a year end", () => {
    const start = startOfMonthInZone(new Date("2026-12-15T12:00:00Z"), "Asia/Karachi");
    expect(start.toISOString()).toBe("2026-11-30T19:00:00.000Z");
    expect(addMonthsInZone(start, 1, "Asia/Karachi").toISOString()).toBe("2026-12-31T19:00:00.000Z");
    expect(addMonthsInZone(start, -1, "Asia/Karachi").toISOString()).toBe("2026-10-31T19:00:00.000Z");
  });

  it("validates zone names", () => {
    expect(isValidTimeZone("Asia/Karachi")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
  });
});
