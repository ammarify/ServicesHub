import { env } from "../config/env.js";
import { clearAuthCaches } from "../middleware/auth.js";
import { DemoState } from "../models/index.js";
import { seedDatabase } from "../seed/seedData.js";

// A public demo is used by strangers who change and delete things, so its
// data is replaced with a fresh copy every DEMO_RESET_HOURS. The time of the
// last reset is stored in the database, which keeps the schedule right when
// the host stops and restarts the process (free hosting sleeps when idle):
// the check runs at startup and every few minutes after.

const HOUR_MS = 60 * 60 * 1000;
const CHECK_EVERY_MS = 10 * 60 * 1000;
const STATE_ID = "demo";

export function isResetDue(lastResetAt, hours, now = new Date()) {
  if (!lastResetAt) return true;
  return now.getTime() - new Date(lastResetAt).getTime() >= hours * HOUR_MS;
}

let resetting = false;

// Returns true when it replaced the data. Everyone is signed out (sessions are
// part of the data) and open sockets are dropped, so browsers reconnect to
// the fresh state and land on the sign-in page.
export async function resetDemoDataIfDue({ hours, io, now = new Date() }) {
  if (resetting) return false;
  resetting = true;
  try {
    const state = await DemoState.findById(STATE_ID).lean();
    if (!isResetDue(state?.lastResetAt, hours, now)) return false;

    await seedDatabase({ now });
    await DemoState.updateOne({ _id: STATE_ID }, { $set: { lastResetAt: now } }, { upsert: true });
    clearAuthCaches();
    io?.disconnectSockets(true);
    return true;
  } finally {
    resetting = false;
  }
}

// Starts the schedule when DEMO_MODE and DEMO_RESET_HOURS are both set.
export function startDemoResets({ io } = {}) {
  const hours = env.DEMO_RESET_HOURS;
  if (!env.DEMO_MODE || !hours) return null;

  const check = () =>
    resetDemoDataIfDue({ hours, io })
      .then((didReset) => {
        if (didReset) console.log(`Demo data reset (next one in ${hours} h).`);
      })
      .catch((err) => console.error("Demo data reset failed:", err.message));

  check();
  const timer = setInterval(check, CHECK_EVERY_MS);
  timer.unref();
  return timer;
}
