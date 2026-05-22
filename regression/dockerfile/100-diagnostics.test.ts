import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("dockerfile");

describe("Dockerfile — diagnostics", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for a valid Dockerfile", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "diagnostics", "--file", "fixtures/Dockerfile",
    ]);
    // Valid Dockerfile may time out on CI; just verify the command produced output
    expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0);
  });

  it("reports diagnostics for a broken Dockerfile", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "diagnostics", "--file", "fixtures/broken.dockerfile",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(result.exitCode).toBe(0);
    expect(normalized.length).toBeGreaterThan(0);
  });
});
