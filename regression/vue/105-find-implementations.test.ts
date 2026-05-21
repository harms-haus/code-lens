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
    // classes.vue line 2: abstract class Animal — "Animal" at col 19
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-implementations",
      "--file",
      "fixtures/classes.vue",
      "--line",
      "2",
      "--col",
      "19",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("implementations-of-animal");
  });
});
