import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  CLIENT_URL: z.string().url("CLIENT_URL must be a valid URL"),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  GROQ_API_KEY: z.string().min(1, "GROQ_API_KEY is required"),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  // Dev-only override for manually exercising the silent-refresh flow
  // without waiting out a real 15-minute access token. Anything
  // jsonwebtoken's `expiresIn` accepts in this shape - "30s", "15m", "1h".
  ACCESS_TOKEN_TTL: z
    .string()
    .regex(/^\d+(s|m|h|d)$/, "ACCESS_TOKEN_TTL must look like '30s', '15m', '1h', or '7d'")
    .default("15m"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  console.error(
    `\nInvalid or missing environment variables. Refusing to start.\n${issues}\n`
  );
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
