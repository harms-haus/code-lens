import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("html");

describe("HTML — hover", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows hover info for a <title> element", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.html line 5: <title>Test Page</title> — "title" at line 5, col 10
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "hover", "--file", "fixtures/valid.html", "--line", "5", "--col", "10",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized.length).toBeGreaterThan(0);
  });
});
