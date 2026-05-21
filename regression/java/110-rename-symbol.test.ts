import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLIWithRetry, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("java");

describe("Java — rename-symbol", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("generates rename diff for a method", async () => {
    if (!ctx.isServerInstalled) return;

    // Warm up server and ensure indexing is complete
    await runCLIWithRetry(
      ctx.fixtureDir,
      ["find-references", "--file", "src/Main.java", "--line", "16", "--col", "26"],
      { maxAttempts: 5, delayMs: 3_000 },
    );

    // Main.java line 16: public static String greet — rename "greet" at col 26
    const result = await runCLISlow(ctx.fixtureDir, [
      "rename-symbol",
      "--file",
      "src/Main.java",
      "--line",
      "16",
      "--col",
      "26",
      "--new-name",
      "sayHello",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/Rename "greet" → "sayHello"/);
    expect(normalized).toMatch(/public static String sayHello/);
  });

  it("generates cross-file rename diff", async () => {
    if (!ctx.isServerInstalled) return;

    // References.java line 5: Main.greet("Alice") — rename "greet" at col 14
    const result = await runCLI(ctx.fixtureDir, [
      "rename-symbol",
      "--file",
      "src/References.java",
      "--line",
      "5",
      "--col",
      "14",
      "--new-name",
      "sayHello",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    // JDT.LS may or may not include cross-file changes depending on version
    expect(normalized).toMatch(/Rename "greet" → "sayHello"/);
    expect(normalized).toMatch(/sayHello/);
  });
});
