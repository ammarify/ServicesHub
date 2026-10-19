import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

// src/config/env.js validates process.env once, at import time, and exits on
// failure, so each case loads it in a fresh Node process. The process runs
// in an empty directory so no developer .env file is picked up by dotenv.
const ENV_MODULE = pathToFileURL(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src/config/env.js")
).href;
const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "servihub-env-test-"));

afterAll(() => {
  fs.rmSync(emptyDir, { recursive: true, force: true });
});

const BASE_ENV = {
  MONGODB_URI: "mongodb://127.0.0.1:27017/servihub",
  CLIENT_URL: "http://localhost:5173",
  JWT_ACCESS_SECRET: "a".repeat(64),
  JWT_REFRESH_SECRET: "b".repeat(64),
};

function loadEnv(vars) {
  const script = `
    const { env } = await import(${JSON.stringify(ENV_MODULE)});
    console.log(JSON.stringify({
      demoMode: env.DEMO_MODE,
      groq: env.GROQ_API_KEY ?? null,
      groqModel: env.GROQ_MODEL,
      cookieDomain: env.COOKIE_DOMAIN ?? null,
      timezone: env.APP_TIMEZONE,
      appUrl: env.APP_URL,
    }));
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: emptyDir,
    env: { PATH: process.env.PATH, ...vars },
    encoding: "utf8",
  });
  return {
    status: result.status,
    stderr: result.stderr,
    config: result.status === 0 ? JSON.parse(result.stdout.trim().split("\n").pop()) : null,
  };
}

describe("environment validation", () => {
  it("treats blank values (as in .env.example) as not set", () => {
    const { status, config, stderr } = loadEnv({
      ...BASE_ENV,
      DEMO_MODE: "",
      GROQ_API_KEY: "",
      GROQ_MODEL: "",
      COOKIE_DOMAIN: "  ",
      APP_TIMEZONE: "",
      RESET_PASSWORD_URL_BASE: "",
    });

    expect(stderr).toBe("");
    expect(status).toBe(0);
    expect(config).toEqual({
      demoMode: true, // default outside production
      groq: null,
      groqModel: "openai/gpt-oss-120b", // llama-3.3-70b-versatile was retired on 2026-08-16
      cookieDomain: null,
      timezone: "America/Chicago",
      appUrl: "http://localhost:5173",
    });
  });

  it("keeps demo mode off in production unless it is switched on", () => {
    expect(loadEnv({ ...BASE_ENV, NODE_ENV: "production", DEMO_MODE: "" }).config.demoMode).toBe(false);
    expect(loadEnv({ ...BASE_ENV, NODE_ENV: "production", DEMO_MODE: "true" }).config.demoMode).toBe(true);
  });

  it("refuses to start without a required secret and names it", () => {
    const { status, stderr } = loadEnv({ ...BASE_ENV, JWT_ACCESS_SECRET: "" });

    expect(status).toBe(1);
    expect(stderr).toContain("JWT_ACCESS_SECRET is required");
  });

  it("refuses secrets that are too short", () => {
    const { status, stderr } = loadEnv({ ...BASE_ENV, JWT_REFRESH_SECRET: "short" });

    expect(status).toBe(1);
    expect(stderr).toContain("JWT_REFRESH_SECRET must be at least 32 characters");
  });
});
