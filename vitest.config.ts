import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/setup.ts", "src/types.ts"],
      thresholds: {
        statements: 65,
        branches: 55,
        functions: 65,
        lines: 65,
      },
    },
  },
});
