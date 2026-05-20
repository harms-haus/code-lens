import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("cpp");

describe("C/C++ — find-references", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("finds references to add function", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLISlow(ctx.fixtureDir, [
      "find-references", "--file", "fixtures/main.c", "--line", "3", "--col", "5",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("references-to-add");
  });

  it("finds references to Point typedef", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLISlow(ctx.fixtureDir, [
      "find-references", "--file", "fixtures/main.c", "--line", "14", "--col", "3",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("references-to-point");
  });
});
