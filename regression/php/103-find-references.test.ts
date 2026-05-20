import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("php");

describe("PHP — find-references", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("finds references to greet function", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-references", "--file", "fixtures/valid.php", "--line", "3", "--col", "10",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/References found: \d+ location/);
  });

  it("finds references to Calculator class", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-references", "--file", "fixtures/valid.php", "--line", "11", "--col", "7",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/References found: \d+ location/);
  });
});
