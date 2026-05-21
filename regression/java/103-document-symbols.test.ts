import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("java");

describe("Java — document-symbols", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 60_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("lists all symbols in Main.java", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLIWithRetry(
      ctx.fixtureDir,
      ["find-document-symbols", "--file", "src/Main.java"],
      { maxAttempts: 5, delayMs: 3_000 },
    );

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols-main");
  });

  it("lists symbols in Calculator.java including class members", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLIWithRetry(
      ctx.fixtureDir,
      ["find-document-symbols", "--file", "src/Calculator.java"],
      { maxAttempts: 5, delayMs: 3_000 },
    );

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols-calculator");
  });

  it("lists symbols in Animal.java including abstract class members", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLIWithRetry(
      ctx.fixtureDir,
      ["find-document-symbols", "--file", "src/Animal.java"],
      { maxAttempts: 5, delayMs: 3_000 },
    );

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols-animal");
  });
});
