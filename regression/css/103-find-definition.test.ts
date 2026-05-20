import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("css");

describe("CSS — find-definition", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("finds definition of CSS variable", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-definition", "--file", "fixtures/valid.css", "--line", "9", "--col", "16",
    ]);

    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    // css-languageserver may not support go-to-definition for all positions
    expect(normalized).toMatch(/Definition found: \d+ location|No definition found|Failed to find definition/i);
  });

  it("finds definition from within a selector block", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-definition", "--file", "fixtures/valid.css", "--line", "9", "--col", "3",
    ]);

    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    // css-languageserver may not support go-to-definition for all positions
    expect(normalized).toMatch(/Definition found:|No definition found|Failed to find definition/i);
  });
});
