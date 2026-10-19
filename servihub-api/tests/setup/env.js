// Test configuration, applied before any application module loads.
// Every optional integration is set explicitly (to empty = "off") so that
// values from a developer's local .env (real Groq/Resend/Google keys) can
// never leak into a test run - dotenv does not override variables that are
// already set.
const testEnv = {
  NODE_ENV: "test",
  MONGODB_URI: "mongodb://127.0.0.1:27017/servihub-test-placeholder",
  CLIENT_URL: "http://localhost:5173",
  JWT_ACCESS_SECRET: "test-access-secret-0123456789abcdef0123456789",
  JWT_REFRESH_SECRET: "test-refresh-secret-0123456789abcdef012345678",
  ACCESS_TOKEN_TTL: "15m",
  REFRESH_TOKEN_TTL: "30d",
  SESSION_TOKEN_TTL: "12h",
  GROQ_API_KEY: "",
  GROQ_MODEL: "",
  GOOGLE_CLIENT_ID: "",
  RESEND_API_KEY: "",
  RESET_PASSWORD_URL_BASE: "",
  DEMO_MODE: "true",
  DISABLE_RATE_LIMITS: "true",
  APP_TIMEZONE: "America/Chicago",
  COOKIE_SAMESITE: "lax",
  COOKIE_DOMAIN: "",
  TRUST_PROXY: "0",
};

Object.assign(process.env, testEnv);
