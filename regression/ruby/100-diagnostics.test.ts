import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("ruby");

describe("Ruby — diagnostics", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("reports diagnostics for a valid file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "diagnostics",
      "--file",
      "fixtures/valid.rb",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    // Verify diagnostics ran successfully and produced output with ruby language tag
    expect(normalized).toContain("(ruby)");
    expect(normalized).toMatch(/\d+ error\(s\), \d+ warning\(s\), \d+ info message\(s\)/);
  });

  it("reports diagnostics for a broken file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "diagnostics",
      "--file",
      "fixtures/broken.rb",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    // Verify diagnostics ran successfully and produced output with ruby language tag
    expect(normalized).toContain("(ruby)");
    expect(normalized).toMatch(/\d+ error\(s\), \d+ warning\(s\), \d+ info message\(s\)/);
  });
});
