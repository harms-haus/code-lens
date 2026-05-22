import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("vue");

describe("Vue — find-implementations", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("finds implementations of Animal base class", async () => {
    if (!ctx.isServerInstalled) return;
    // classes.vue line 2: class Animal — "Animal" at col 6
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-implementations",
      "--file",
      "fixtures/classes.vue",
      "--line",
      "2",
      "--col",
      "6",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized.length).toBeGreaterThan(0);
  });
});
