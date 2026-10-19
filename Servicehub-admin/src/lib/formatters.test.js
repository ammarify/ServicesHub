import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatDateKey,
  formatPercent,
  formatUSD,
  humanize,
  initials,
  parseDateKey,
  relativeTime,
  toDateTimeInputValue,
} from "./formatters";

describe("formatUSD", () => {
  it("drops cents for whole amounts and keeps them otherwise", () => {
    expect(formatUSD(4500)).toBe("$4,500");
    expect(formatUSD(1240.5)).toBe("$1,240.50");
  });

  it("treats missing values as zero", () => {
    expect(formatUSD(undefined)).toBe("$0");
    expect(formatUSD("abc")).toBe("$0");
  });
});

describe("date keys", () => {
  it("parses a calendar day as a local date, not UTC midnight", () => {
    const date = parseDateKey("2026-10-14");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(9);
    expect(date.getDate()).toBe(14);
  });

  it("formats a day key without shifting it", () => {
    expect(formatDateKey("2026-10-01")).toBe("Oct 01");
  });
});

describe("relativeTime", () => {
  afterEach(() => vi.useRealTimers());

  it("describes past and future moments", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T12:00:00Z"));
    expect(relativeTime("2026-10-14T11:59:30Z")).toBe("just now");
    expect(relativeTime("2026-10-14T10:00:00Z")).toBe("2h ago");
    expect(relativeTime("2026-10-11T12:00:00Z")).toBe("3d ago");
    expect(relativeTime("2026-10-14T12:30:00Z")).toBe("in 30m");
  });
});

describe("text helpers", () => {
  it("builds initials from at most two words", () => {
    expect(initials("Sarah Chen")).toBe("SC");
    expect(initials("Mary Ann Lee")).toBe("MA");
    expect(initials("")).toBe("");
    expect(initials(undefined)).toBe("");
  });

  it("humanizes enum values", () => {
    expect(humanize("in_progress")).toBe("In progress");
    expect(humanize("super_admin")).toBe("Super admin");
    expect(humanize(null)).toBe("");
  });

  it("formats percentages", () => {
    expect(formatPercent(12.345)).toBe("12.3%");
  });

  it("produces a datetime-local value in local time", () => {
    const value = toDateTimeInputValue(new Date(2026, 9, 14, 9, 5));
    expect(value).toBe("2026-10-14T09:05");
  });
});
