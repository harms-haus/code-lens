import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("rust");

/**
 * Run find-calls with retry logic specific to call hierarchy.
 * The standard runCLIWithRetry doesn't recognize "No call hierarchy available"
 * as an empty result, so we add a custom wrapper.
 */
async function runFindCallsWithRetry(
  cwd: string,
  args: string[],
  maxAttempts = 5,
  delayMs = 3_000,
) {
  let lastResult = await runCLI(cwd, args, { timeout: 30_000 });

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const out = lastResult.stdout;
    const isEmpty =
      out.includes("No call hierarchy available") ||
      out.includes("0 locations") ||
      out.includes("0 location\n");

    if (!isEmpty) return lastResult;

    if (attempt < maxAttempts - 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      lastResult = await runCLI(cwd, args, { timeout: 30_000 });
    }
  }

  return lastResult;
}

describe("Rust — find-calls", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("shows call hierarchy for greet function", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLIWithRetry(
      ctx.fixtureDir,
      ["find-calls", "--file", "src/main.rs", "--line", "1", "--col", "4"],
      { maxAttempts: 5, delayMs: 3_000 },
    );

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("call-hierarchy-greet");
  });

  it("shows call hierarchy for Calculator::add method", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runFindCallsWithRetry(
      ctx.fixtureDir,
      ["find-calls", "--file", "src/main.rs", "--line", "18", "--col", "8"],
    );

    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("calls-add");
  });
});
