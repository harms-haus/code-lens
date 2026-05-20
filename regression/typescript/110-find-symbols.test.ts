import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("typescript");

describe("TypeScript — find-symbols", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("finds symbols matching 'greet'", async () => {
    if (!ctx.isServerInstalled) return;

    // Warm up server with find-document-symbols first
    await runCLISlow(ctx.fixtureDir, [
      "find-document-symbols",
      "--file",
      "fixtures/valid.ts",
    ]);

    const result = await runCLI(ctx.fixtureDir, [
      "find-symbols",
      "--query",
      "greet",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, {
      fixtureDir: ctx.fixtureDir,
    });
    expect(normalized).toMatchSnapshot("symbols-greet");
  });

  it("finds symbols matching 'Calculator'", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLI(ctx.fixtureDir, [
      "find-symbols",
      "--query",
      "Calculator",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, {
      fixtureDir: ctx.fixtureDir,
    });
    expect(normalized).toMatchSnapshot("symbols-calculator");
  });

  it("returns empty results for non-matching query", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLI(ctx.fixtureDir, [
      "find-symbols",
      "--query",
      "xyznonexistent123",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, {
      fixtureDir: ctx.fixtureDir,
    });
    expect(normalized).toMatchSnapshot("symbols-no-match");
  });
});
