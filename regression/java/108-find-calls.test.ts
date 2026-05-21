import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("java");

describe("Java — find-calls", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("shows call hierarchy for greet method", async () => {
    if (!ctx.isServerInstalled) return;

    // Main.java line 16: public static String greet(String name) — "greet" at col 26
    const result = await runCLIWithRetry(
      ctx.fixtureDir,
      [
        "find-calls",
        "--file",
        "src/Main.java",
        "--line",
        "16",
        "--col",
        "26",
      ],
      { maxAttempts: 5, delayMs: 3_000 },
    );

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("calls-greet");
  });

  it("shows call hierarchy for Calculator.add method", async () => {
    if (!ctx.isServerInstalled) return;

    // Calculator.java line 4: public int add(int a, int b) — "add" at col 16
    const result = await runCLIWithRetry(
      ctx.fixtureDir,
      [
        "find-calls",
        "--file",
        "src/Calculator.java",
        "--line",
        "4",
        "--col",
        "16",
      ],
      { maxAttempts: 5, delayMs: 3_000 },
    );

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("calls-calculator-add");
  });
});
