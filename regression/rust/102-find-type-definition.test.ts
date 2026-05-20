import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("rust");

describe("Rust — find-type-definition", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("finds type definition of variable", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLIWithRetry(
      ctx.fixtureDir,
      ["find-type-definition", "--file", "src/main.rs", "--line", "25", "--col", "9"],
      { maxAttempts: 5, delayMs: 3_000 },
    );

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    // rust-analyzer may or may not resolve the type definition depending on version
    expect(normalized).toMatch(/Type definition found: \d+ location/);
  });

  it("finds type definition of struct instance", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLIWithRetry(
      ctx.fixtureDir,
      ["find-type-definition", "--file", "src/main.rs", "--line", "28", "--col", "13"],
      { maxAttempts: 5, delayMs: 3_000 },
    );

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("type-definition-calc");
  });
});
