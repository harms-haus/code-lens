import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("svelte");

describe("Svelte — find-calls", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("shows call hierarchy for increment function", async () => {
    if (!ctx.isServerInstalled) return;
    // references.svelte line 8: function increment — "increment" at col 12
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-calls",
      "--file",
      "fixtures/references.svelte",
      "--line",
      "8",
      "--col",
      "12",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("calls-of-increment");
  });
});
