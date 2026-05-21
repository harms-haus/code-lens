import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("java");

describe("Java — find-implementations", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("finds implementations of Animal abstract class", async () => {
    if (!ctx.isServerInstalled) return;

    // Animal.java line 3: public abstract class Animal — "Animal" at col 23
    const result = await runCLIWithRetry(
      ctx.fixtureDir,
      [
        "find-implementations",
        "--file",
        "src/Animal.java",
        "--line",
        "3",
        "--col",
        "23",
      ],
      { maxAttempts: 5, delayMs: 3_000 },
    );

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("implementations-of-animal");
  });

  it("finds implementations of Animal.speak abstract method", async () => {
    if (!ctx.isServerInstalled) return;

    // Animal.java line 10: public abstract String speak() — "speak" at col 28
    const result = await runCLIWithRetry(
      ctx.fixtureDir,
      [
        "find-implementations",
        "--file",
        "src/Animal.java",
        "--line",
        "10",
        "--col",
        "28",
      ],
      { maxAttempts: 5, delayMs: 3_000 },
    );

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("implementations-of-speak");
  });
});
