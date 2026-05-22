import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("html");

describe("HTML — document-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("lists document symbols in HTML", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/valid.html",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/\d+ symbols? found/);
  });
});
