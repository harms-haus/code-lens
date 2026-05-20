import { defineConfig } from "vitest/config";

/**
 * Base Vitest configuration for regression tests.
 *
 * - NO global mocks (unlike tests/setup.ts which mocks node:child_process, node:net, etc.)
 * - Uses forks pool for process isolation
 * - Extended timeouts for real LSP server communication
 * - Separate from vitest.config.ts to avoid interfering with unit tests
 */
export default defineConfig({
  test: {
    include: ["regression/**/*.test.ts"],
    pool: "forks",
    testTimeout: 120_000, // 2 minutes per test (LSP server startup can be slow)
    hookTimeout: 60_000, // 1 minute for beforeAll/afterAll
    setupFiles: [], // No global mocks
    // No coverage collection for regression tests
  },
});
