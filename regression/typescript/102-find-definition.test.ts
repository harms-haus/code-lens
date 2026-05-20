import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("typescript");

describe("TypeScript — find-definition", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("finds definition of an imported function", async () => {
    if (!ctx.isServerInstalled) return;
    // references.ts line 1: import { greet } — "greet" at col 10
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-definition",
      "--file",
      "fixtures/references.ts",
      "--line",
      "1",
      "--col",
      "10",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-greet");
  });

  it("finds definition of an imported class", async () => {
    if (!ctx.isServerInstalled) return;
    // references.ts line 5: const calc = new Calculator() — "Calculator" at col 22
    const result = await runCLI(ctx.fixtureDir, [
      "find-definition",
      "--file",
      "fixtures/references.ts",
      "--line",
      "5",
      "--col",
      "22",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-calculator");
  });

  it("finds definition of an imported type", async () => {
    if (!ctx.isServerInstalled) return;
    // references.ts line 8: const user: User — "User" at col 15
    const result = await runCLI(ctx.fixtureDir, [
      "find-definition",
      "--file",
      "fixtures/references.ts",
      "--line",
      "8",
      "--col",
      "15",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-user-type");
  });

  it("returns same location for locally defined symbol", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.ts line 1: function greet — already at definition
    const result = await runCLI(ctx.fixtureDir, [
      "find-definition",
      "--file",
      "fixtures/valid.ts",
      "--line",
      "1",
      "--col",
      "18",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-local-symbol");
  });
});
