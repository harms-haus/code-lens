import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("java");

describe("Java — hover", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("shows type info for a method", async () => {
    if (!ctx.isServerInstalled) return;
    // Main.java line 16: public static String greet(String name) — "greet" at col 26
    const result = await runCLIWithRetry(
      ctx.fixtureDir,
      [
        "hover",
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
    expect(normalized).toMatchSnapshot("hover-greet");
  });

  it("shows type info for a variable", async () => {
    if (!ctx.isServerInstalled) return;
    // Main.java line 5: String greeting = greet("World") — "greeting" at col 16
    const result = await runCLIWithRetry(
      ctx.fixtureDir,
      [
        "hover",
        "--file",
        "src/Main.java",
        "--line",
        "5",
        "--col",
        "16",
      ],
      { maxAttempts: 5, delayMs: 3_000 },
    );

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-variable");
  });

  it("shows type info for a class", async () => {
    if (!ctx.isServerInstalled) return;
    // Main.java line 8: Calculator calc — "Calculator" at col 9
    const result = await runCLIWithRetry(
      ctx.fixtureDir,
      [
        "hover",
        "--file",
        "src/Main.java",
        "--line",
        "8",
        "--col",
        "9",
      ],
      { maxAttempts: 5, delayMs: 3_000 },
    );

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-class");
  });
});
