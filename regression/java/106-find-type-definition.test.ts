import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("java");

describe("Java — find-type-definition", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("finds type definition of Calculator instance", async () => {
    if (!ctx.isServerInstalled) return;

    // Main.java line 8: Calculator calc = new Calculator() — "calc" at col 20
    const result = await runCLIWithRetry(
      ctx.fixtureDir,
      [
        "find-type-definition",
        "--file",
        "src/Main.java",
        "--line",
        "8",
        "--col",
        "20",
      ],
      { maxAttempts: 5, delayMs: 3_000 },
    );

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("type-definition-of-calc");
  });

  it("finds type definition of Dog instance", async () => {
    if (!ctx.isServerInstalled) return;

    // References.java line 12: Dog dog = new Dog("Rex") — "dog" at col 13
    const result = await runCLIWithRetry(
      ctx.fixtureDir,
      [
        "find-type-definition",
        "--file",
        "src/References.java",
        "--line",
        "12",
        "--col",
        "13",
      ],
      { maxAttempts: 5, delayMs: 3_000 },
    );

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("type-definition-of-dog");
  });

  it("finds type definition at definition site returns same location", async () => {
    if (!ctx.isServerInstalled) return;

    // Main.java line 8: Calculator calc — "Calculator" at col 9 (already at definition)
    const result = await runCLIWithRetry(
      ctx.fixtureDir,
      [
        "find-type-definition",
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
    expect(normalized).toMatchSnapshot("type-definition-local");
  });
});
