import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("vue");

describe("Vue — find-type-hierarchy", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("shows type hierarchy for Animal class", async () => {
    if (!ctx.isServerInstalled) return;
    // classes.vue line 2: abstract class Animal — "Animal" at col 19
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-type-hierarchy",
      "--file",
      "fixtures/classes.vue",
      "--line",
      "2",
      "--col",
      "19",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("type-hierarchy-of-animal");
  });
});
