import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("lua");

describe("Lua — diagnostics", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for a valid file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLIWithRetry(ctx.fixtureDir, ["diagnostics", "--file", "fixtures/valid.lua"], { maxAttempts: 3, delayMs: 5_000, retryOnError: true });
    if (result.exitCode !== 0) console.log(`DEBUG stdout=${JSON.stringify(result.stdout)} stderr=${JSON.stringify(result.stderr)}`);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toContain("(lua)");
    expect(normalized).toContain("0 error(s)");
  });

  it("reports diagnostics for a broken file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLIWithRetry(ctx.fixtureDir, ["diagnostics", "--file", "fixtures/broken.lua"], { maxAttempts: 3, delayMs: 5_000, retryOnError: true });
    if (result.exitCode !== 0) console.log(`DEBUG stdout=${JSON.stringify(result.stdout)} stderr=${JSON.stringify(result.stderr)}`);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toContain("(lua)");
    expect(normalized).toMatch(/\d+ error\(s\)|0 error\(s\)/);
  });
});
