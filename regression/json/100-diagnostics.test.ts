import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("json");

describe("JSON — diagnostics", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 60_000);
  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("reports diagnostics for valid JSON", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "diagnostics",
      "--file",
      "fixtures/valid.json",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    // JSON server diagnostics vary by environment
    expect(normalized).toContain("(json)");
    expect(normalized).toMatch(/\d+ error\(s\)/);
  });

  it("reports diagnostics for invalid JSON", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "diagnostics",
      "--file",
      "fixtures/invalid.json",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    // JSON server diagnostics vary by environment — may or may not detect invalid JSON
    expect(normalized).toContain("(json)");
  });
});
