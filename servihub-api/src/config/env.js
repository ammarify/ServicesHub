import "dotenv/config";
import { z } from "zod";

// Optional string settings: an empty value in .env ("GROQ_API_KEY=") means
// "not configured", not "configured as an empty string".
const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const booleanString = z
  .string()
  .trim()
  .toLowerCase()
  .refine((value) => ["true", "false", "1", "0", "yes", "no"].includes(value), {
    message: "must be true or false",
  })
  .transform((value) => ["true", "1", "yes"].includes(value));

const duration = (name) =>
  z.string().regex(/^\d+(s|m|h|d)$/, `${name} must look like '30s', '15m', '12h', or '30d'`);

function isValidTimeZone(value) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const required = (name) => z.string({ error: `${name} is required` });

// Groq retires models every few months (llama-3.3-70b-versatile, the previous
// default, was shut down on 2026-08-16); see
// https://console.groq.com/docs/deprecations before changing this.
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: required("MONGODB_URI").min(1, "MONGODB_URI is required"),

  // One or more allowed browser origins, comma-separated. The first one is
  // also the base URL used for links in emails (password reset, invites).
  CLIENT_URL: required("CLIENT_URL")
    .min(1, "CLIENT_URL is required")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim().replace(/\/+$/, ""))
        .filter(Boolean)
    )
    .pipe(z.array(z.string().url("CLIENT_URL must contain valid URLs")).min(1)),

  JWT_ACCESS_SECRET: required("JWT_ACCESS_SECRET").min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET").min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  // Access tokens are short-lived on purpose; the refresh flow renews them.
  // Lowering this (e.g. "30s") is handy for exercising silent refresh by hand.
  ACCESS_TOKEN_TTL: duration("ACCESS_TOKEN_TTL").default("15m"),
  // Refresh-session lifetime when "Keep me logged in" is ticked (sliding:
  // every refresh extends it) ...
  REFRESH_TOKEN_TTL: duration("REFRESH_TOKEN_TTL").default("30d"),
  // ... and when it isn't. Those cookies are also browser-session cookies,
  // so closing the browser ends the session even sooner.
  SESSION_TOKEN_TTL: duration("SESSION_TOKEN_TTL").default("12h"),

  // Optional integrations. The app boots without them; the matching feature
  // reports itself as unavailable instead.
  GROQ_API_KEY: optionalString,
  GROQ_MODEL: z.string().trim().min(1).default(DEFAULT_GROQ_MODEL),
  GOOGLE_CLIENT_ID: optionalString,
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: z.string().trim().min(1).default("ServiHub <onboarding@resend.dev>"),
  // Overrides the reset/invite link base (defaults to <first CLIENT_URL>/reset-password).
  RESET_PASSWORD_URL_BASE: optionalString.pipe(z.string().url().optional()),

  // Demo conveniences: password-less demo login and the public customer
  // simulator. On by default outside production, off in production unless
  // explicitly enabled.
  DEMO_MODE: booleanString.optional(),

  // Business time zone used when a client doesn't send its own (dashboard
  // "today"/"this week" boundaries). ServiHub operates in Austin, TX.
  APP_TIMEZONE: z
    .string()
    .default("America/Chicago")
    .refine(isValidTimeZone, { message: "APP_TIMEZONE must be a valid IANA time zone" }),

  // Number of reverse proxies in front of the API (Render, Railway, nginx,
  // ...). Needed so rate limiting and logs see the real client IP.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  // Auth cookie scope. "lax" works when the admin app and the API share a
  // site (localhost:5173 + localhost:5000, app.example.com +
  // api.example.com). Hosting them on unrelated domains needs "none", which
  // browsers only accept over HTTPS.
  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
  COOKIE_DOMAIN: optionalString,

  // Turns every rate limiter off. Only meant for automated test runs that
  // sign in many times from one IP.
  DISABLE_RATE_LIMITS: booleanString.optional().default(false),
});

// A blank value ("DEMO_MODE=" in .env, as in .env.example) means "not set":
// the setting falls back to its default instead of failing validation.
const rawEnv = Object.fromEntries(
  Object.entries(process.env).map(([key, value]) => [key, typeof value === "string" && value.trim() === "" ? undefined : value])
);

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  console.error(`\nInvalid or missing environment variables. Refusing to start.\n${issues}\n`);
  process.exit(1);
}

const data = parsed.data;

export const env = {
  ...data,
  DEMO_MODE: data.DEMO_MODE ?? data.NODE_ENV !== "production",
  // The first allowed origin doubles as the public URL of the admin app.
  APP_URL: data.CLIENT_URL[0],
};

export const isProduction = env.NODE_ENV === "production";
