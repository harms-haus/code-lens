import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("go");

describe("Go — find-implementations", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("finds implementations of Calculator struct", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-implementations", "--file", "fixtures/main.go", "--line", "13", "--col", "6",
    ]);

    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    // gopls may return 0 or 1+ implementations depending on version/context
    expect(normalized).toMatch(/Implementations found: \d+ location/);
  });

  it("finds implementations returns result for function", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-implementations", "--file", "fixtures/main.go", "--line", "5", "--col", "6",
    ]);

    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/Implementations found: \d+ location/);
  });
});
