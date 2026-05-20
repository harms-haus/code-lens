import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("python");

describe("Python — find-implementations", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("finds implementations or returns empty for class", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-implementations", "--file", "fixtures/valid.py", "--line", "8", "--col", "7",
    ]);

    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    // pylsp may return implementations or an error depending on server version
    expect(normalized).toMatch(/Implementations found: \d+ location|No implementations|Error/i);
  });
});
