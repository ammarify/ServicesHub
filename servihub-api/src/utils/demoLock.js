import { env } from "../config/env.js";
import { ApiError } from "./ApiError.js";

// While DEMO_MODE is on, every visitor shares the seeded accounts. Changes
// that would lock other visitors out of a role (a new password, "sign out
// everywhere", a role change, disabling) or rename the account for everyone
// are refused for them. Members invited during the demo can still try all
// of it.
export function isLockedDemoAccount(user) {
  return Boolean(env.DEMO_MODE && user?.demoAccount);
}

export function assertNotLockedDemoAccount(user, message) {
  if (isLockedDemoAccount(user)) {
    throw new ApiError(403, message, "DEMO_LOCKED");
  }
}
