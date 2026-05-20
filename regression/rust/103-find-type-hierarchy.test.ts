import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("rust");

describe("Rust — find-type-hierarchy", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("shows type hierarchy for Calculator struct", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLIWithRetry(
      ctx.fixtureDir,
      ["find-type-hierarchy", "--file", "src/main.rs", "--line", "9", "--col", "8", "--direction", "both"],
      { maxAttempts: 5, delayMs: 3_000 },
    );

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("type-hierarchy-calculator");
  });
});
