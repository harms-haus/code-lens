import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("java");

describe("Java — find-type-hierarchy", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("shows supertypes of Dog class", async () => {
    if (!ctx.isServerInstalled) return;

    // Dog.java line 3: public class Dog extends Animal — "Dog" at col 14
    const result = await runCLIWithRetry(
      ctx.fixtureDir,
      [
        "find-type-hierarchy",
        "--file",
        "src/Dog.java",
        "--line",
        "3",
        "--col",
        "14",
        "--direction",
        "supertypes",
      ],
      { maxAttempts: 5, delayMs: 3_000 },
    );

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("type-hierarchy-dog-supertypes");
  });

  it("shows subtypes of Animal class", async () => {
    if (!ctx.isServerInstalled) return;

    // Animal.java line 3: public abstract class Animal — "Animal" at col 23
    const result = await runCLI(
      ctx.fixtureDir,
      [
        "find-type-hierarchy",
        "--file",
        "src/Animal.java",
        "--line",
        "3",
        "--col",
        "23",
        "--direction",
        "subtypes",
      ],
    );

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("type-hierarchy-animal-subtypes");
  });

  it("shows both directions for Dog class", async () => {
    if (!ctx.isServerInstalled) return;

    // Dog.java line 3: public class Dog — "Dog" at col 14
    const result = await runCLI(
      ctx.fixtureDir,
      [
        "find-type-hierarchy",
        "--file",
        "src/Dog.java",
        "--line",
        "3",
        "--col",
        "14",
        "--direction",
        "both",
      ],
    );

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("type-hierarchy-dog-both");
  });
});
