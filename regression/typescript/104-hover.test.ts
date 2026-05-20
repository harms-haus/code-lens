import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("typescript");

describe("TypeScript — hover", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("shows type info for a function", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.ts line 1: function greet(name: string): string — hover on "greet" at col 18
    const result = await runCLISlow(ctx.fixtureDir, [
      "hover",
      "--file",
      "fixtures/valid.ts",
      "--line",
      "1",
      "--col",
      "18",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-function");
  });

  it("shows type info for a variable", async () => {
    if (!ctx.isServerInstalled) return;
    // references.ts line 3: const message = greet("world") — hover on "message" at col 7
    const result = await runCLI(ctx.fixtureDir, [
      "hover",
      "--file",
      "fixtures/references.ts",
      "--line",
      "3",
      "--col",
      "7",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-variable");
  });

  it("shows type info for a class", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.ts line 9: class Calculator — hover on "Calculator" at col 15
    const result = await runCLI(ctx.fixtureDir, [
      "hover",
      "--file",
      "fixtures/valid.ts",
      "--line",
      "9",
      "--col",
      "15",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-class");
  });
});
