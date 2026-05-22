import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("svelte");

describe("Svelte — find-references", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("finds references to increment function", async () => {
    if (!ctx.isServerInstalled) return;
    // references.svelte line 6: function increment — "increment" at col 11
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-references",
      "--file",
      "fixtures/references.svelte",
      "--line",
      "6",
      "--col",
      "11",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("references-to-increment");
  });
});
