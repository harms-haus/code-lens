import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("vue");

describe("Vue — hover", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("shows type info for greet function", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.vue line 2: function greet(name: string): string — hover on "greet" at col 10
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "hover",
      "--file",
      "fixtures/valid.vue",
      "--line",
      "2",
      "--col",
      "10",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized.length).toBeGreaterThan(0);
  });
});
