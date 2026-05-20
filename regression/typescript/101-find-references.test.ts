import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("typescript");

describe("TypeScript — find-references", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("finds references to an exported function", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.ts line 1: export function greet — "greet" at col 18
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-references",
      "--file",
      "fixtures/valid.ts",
      "--line",
      "1",
      "--col",
      "18",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("references-to-greet");
  });

  it("finds references to Calculator.add method", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.ts line 12: add(a: number, b: number) — "add" at col 3
    const result = await runCLI(ctx.fixtureDir, [
      "find-references",
      "--file",
      "fixtures/valid.ts",
      "--line",
      "12",
      "--col",
      "3",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("references-to-add");
  });

  it("finds cross-file references to greet from references.ts", async () => {
    if (!ctx.isServerInstalled) return;
    // references.ts line 3: const message = greet("world") — "greet" at col 18
    const result = await runCLI(ctx.fixtureDir, [
      "find-references",
      "--file",
      "fixtures/references.ts",
      "--line",
      "3",
      "--col",
      "18",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("cross-file-references");
  });
});
