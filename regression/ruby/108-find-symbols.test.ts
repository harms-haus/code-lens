import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("ruby");

describe("Ruby — find-symbols", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("finds symbols matching 'greet'", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-symbols",
      "--query",
      "greet",
      "--file",
      "fixtures/valid.rb",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized.length).toBeGreaterThan(0);
  });
});
