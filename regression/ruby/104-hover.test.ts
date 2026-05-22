import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("ruby");

describe("Ruby — hover", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("shows type info for greet function", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "hover",
      "--file",
      "fixtures/valid.rb",
      "--line",
      "3",
      "--col",
      "6",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized.length).toBeGreaterThan(0);
  });
});
