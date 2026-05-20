import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("go");

describe("Go — find-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds symbols matching 'greet'", async () => {
    if (!ctx.isServerInstalled) return;

    // Warm up server first
    await runCLIWithRetry(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/main.go",
    ], { maxAttempts: 3, delayMs: 2_000 });

    const result = await runCLI(ctx.fixtureDir, ["find-symbols", "--query", "greet"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("symbols-greet");
  });

  it("finds symbols matching 'Calculator'", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLI(ctx.fixtureDir, ["find-symbols", "--query", "Calculator"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("symbols-calculator");
  });
});
