// The seed data in mockData.js was authored around this calendar day (the
// latest activity in it is the morning of 2026-07-11, UTC).
export const SEED_ANCHOR_DATE = "2026-07-11";

const DAY_MS = 24 * 60 * 60 * 1000;

// Returns a function that moves any mock date forward (or back) by the whole
// number of days between SEED_ANCHOR_DATE and `today`. Whole days keep every
// time of day, weekday spacing and gap between events exactly as authored.
export function makeDateShifter(today) {
  const anchorDay = Date.parse(`${SEED_ANCHOR_DATE}T00:00:00.000Z`);
  const todayDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const offsetMs = Math.round((todayDay - anchorDay) / DAY_MS) * DAY_MS;

  return (value) => new Date(new Date(value).getTime() + offsetMs);
}
