import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Runs before anything imports src/config/env.js.
    setupFiles: ["./tests/setup/env.js"],
    pool: "forks",
    testTimeout: 30_000,
    hookTimeout: 180_000,
    reporters: process.env.GITHUB_ACTIONS ? ["default", "github-actions"] : ["default"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.js"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.js"],
          // Starts one MongoDB (in-memory, or MONGODB_TEST_URI if set).
          globalSetup: ["./tests/setup/globalSetup.js"],
        },
      },
    ],
  },
});
