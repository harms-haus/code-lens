import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("typescript");

describe("TypeScript — find-calls", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("shows call hierarchy for greet function", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLISlow(ctx.fixtureDir, [
      "find-calls",
      "--file",
      "fixtures/valid.ts",
      "--line",
      "1",
      "--col",
      "17",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, {
      fixtureDir: ctx.fixtureDir,
    });
    expect(normalized).toMatchSnapshot("calls-greet");
  });

  it("shows call hierarchy for Calculator.add method", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLI(ctx.fixtureDir, [
      "find-calls",
      "--file",
      "fixtures/valid.ts",
      "--line",
      "12",
      "--col",
      "3",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, {
      fixtureDir: ctx.fixtureDir,
    });
    expect(normalized).toMatchSnapshot("calls-calculator-add");
  });
});
