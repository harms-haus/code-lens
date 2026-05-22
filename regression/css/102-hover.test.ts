import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("css");

describe("CSS — hover", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows hover info for a CSS property", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.css line 8: display: flex — "display" at line 8, col 3
    const result = await runCLISlow(ctx.fixtureDir, [
      "hover", "--file", "fixtures/valid.css", "--line", "8", "--col", "3",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/Hover information/);
  });
});
