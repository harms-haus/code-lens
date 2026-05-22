import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("html");

describe("HTML — find-definition", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds definition for href attribute", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.html line 12: <a href="#about" class="link">About</a> — "href" at line 12, col 15
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-definition", "--file", "fixtures/valid.html", "--line", "12", "--col", "15",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/Definition found: \d+ locations?/);
  });
});
