// Small time-zone helpers built on Intl (no dependency). They answer "when
// does this calendar day start in <zone>?" correctly across DST changes,
// which plain Date math in the server's own zone can't.

const DAY_MS = 24 * 60 * 60 * 1000;
const formatterCache = new Map();

function partsFormatter(timeZone) {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

const WEEKDAYS = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== "string" || !timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

// Wall-clock fields of `date` as seen in `timeZone`. weekday: 1 = Monday ... 7 = Sunday.
export function zonedParts(date, timeZone) {
  const fields = {};
  for (const part of partsFormatter(timeZone).formatToParts(date)) {
    fields[part.type] = part.value;
  }
  return {
    year: Number(fields.year),
    month: Number(fields.month),
    day: Number(fields.day),
    hour: Number(fields.hour),
    minute: Number(fields.minute),
    second: Number(fields.second),
    weekday: WEEKDAYS[fields.weekday],
  };
}

// How far `timeZone`'s wall clock is ahead of UTC at instant `date`, in ms.
function offsetMs(date, timeZone) {
  const p = zonedParts(date, timeZone);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// The instant at which calendar day (year, month, day) begins in `timeZone`.
// month is 1-12; day may overflow (e.g. 32) and rolls over like Date.UTC.
export function zonedDayStart(year, month, day, timeZone) {
  const wallMidnight = Date.UTC(year, month - 1, day);
  let instant = wallMidnight - offsetMs(new Date(wallMidnight), timeZone);
  // A second pass settles days where the offset differs at the guessed
  // instant (DST transitions).
  const corrected = wallMidnight - offsetMs(new Date(instant), timeZone);
  if (corrected !== instant) instant = corrected;
  return new Date(instant);
}

export function startOfDayInZone(date, timeZone) {
  const p = zonedParts(date, timeZone);
  return zonedDayStart(p.year, p.month, p.day, timeZone);
}

export function addDaysInZone(dayStart, days, timeZone) {
  // Re-derive the calendar date, then move by whole calendar days, so a
  // "day" is 23 or 25 hours long across DST changes, as it should be.
  const p = zonedParts(new Date(dayStart.getTime() + DAY_MS / 2), timeZone);
  return zonedDayStart(p.year, p.month, p.day + days, timeZone);
}

export function startOfWeekInZone(date, timeZone) {
  const p = zonedParts(date, timeZone);
  return zonedDayStart(p.year, p.month, p.day - (p.weekday - 1), timeZone);
}

export function startOfMonthInZone(date, timeZone) {
  const p = zonedParts(date, timeZone);
  return zonedDayStart(p.year, p.month, 1, timeZone);
}

export function addMonthsInZone(monthStart, months, timeZone) {
  const p = zonedParts(new Date(monthStart.getTime() + DAY_MS / 2), timeZone);
  return zonedDayStart(p.year, p.month + months, 1, timeZone);
}

// "YYYY-MM-DD" of the calendar day `date` falls on in `timeZone`.
export function dateKeyInZone(date, timeZone) {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
