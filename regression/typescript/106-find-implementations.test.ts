import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("typescript");

describe("TypeScript — find-implementations", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("finds implementations of Animal base class", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLISlow(ctx.fixtureDir, [
      "find-implementations",
      "--file",
      "fixtures/classes.ts",
      "--line",
      "1",
      "--col",
      "14",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, {
      fixtureDir: ctx.fixtureDir,
    });
    expect(normalized).toMatchSnapshot("implementations-of-animal");
  });

  it("finds implementations of Printable interface", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLISlow(ctx.fixtureDir, [
      "find-implementations",
      "--file",
      "fixtures/classes.ts",
      "--line",
      "22",
      "--col",
      "18",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, {
      fixtureDir: ctx.fixtureDir,
    });
    expect(normalized).toMatchSnapshot("implementations-of-printable");
  });
});
