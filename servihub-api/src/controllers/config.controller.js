import { env } from "../config/env.js";
import { SERVICES } from "../config/services.js";
import { isAiEnabled } from "../services/aiAnalysis.service.js";
import { isEmailConfigured } from "../services/email.service.js";

// Public, non-secret runtime settings the admin app needs before anyone
// signs in: whether to show demo access and the Google button, and the
// service catalogue for filters and forms. Serving them from the API keeps
// a single source of truth instead of duplicating them as build-time
// frontend env vars.
export function getPublicConfig(req, res) {
  res.set("Cache-Control", "public, max-age=60");
  res.status(200).json({
    demoMode: env.DEMO_MODE,
    googleClientId: env.GOOGLE_CLIENT_ID ?? null,
    aiEnabled: isAiEnabled(),
    emailEnabled: isEmailConfigured(),
    services: SERVICES,
    timezone: env.APP_TIMEZONE,
  });
}
