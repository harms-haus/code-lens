import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("java");

describe("Java — find-definition", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("finds definition of Calculator from variable declaration", async () => {
    if (!ctx.isServerInstalled) return;
    // Main.java line 8: Calculator calc = new Calculator() — "Calculator" at col 9
    const result = await runCLIWithRetry(
      ctx.fixtureDir,
      [
        "find-definition",
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
    expect(normalized).toMatchSnapshot("definition-of-calculator");
  });

  it("finds definition of greet from call site", async () => {
    if (!ctx.isServerInstalled) return;
    // Main.java line 5: String greeting = greet("World") — "greet" at col 27
    const result = await runCLIWithRetry(
      ctx.fixtureDir,
      [
        "find-definition",
        "--file",
        "src/Main.java",
        "--line",
        "5",
        "--col",
        "27",
      ],
      { maxAttempts: 5, delayMs: 3_000 },
    );

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-greet");
  });

  it("finds cross-file definition of Calculator from References.java", async () => {
    if (!ctx.isServerInstalled) return;
    // References.java line 8: Calculator calc = new Calculator() — "Calculator" at col 9
    const result = await runCLIWithRetry(
      ctx.fixtureDir,
      [
        "find-definition",
        "--file",
        "src/References.java",
        "--line",
        "8",
        "--col",
        "9",
      ],
      { maxAttempts: 5, delayMs: 3_000 },
    );

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("cross-file-definition-of-calculator");
  });

  it("returns same location for locally defined symbol", async () => {
    if (!ctx.isServerInstalled) return;
    // Main.java line 16: public static String greet — already at definition
    const result = await runCLIWithRetry(
      ctx.fixtureDir,
      [
        "find-definition",
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
    expect(normalized).toMatchSnapshot("definition-local-symbol");
  });
});
