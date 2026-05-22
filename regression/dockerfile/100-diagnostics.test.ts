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
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toContain("(dockerfile)");
    expect(normalized).toMatch(/\d+ error\(s\), \d+ warning\(s\), \d+ info message\(s\)/);
  });

  it("reports diagnostics for a broken Dockerfile", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "diagnostics", "--file", "fixtures/broken.dockerfile",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toContain("(dockerfile)");
    expect(result.stdout.length).toBeGreaterThan(0);
  });
});
