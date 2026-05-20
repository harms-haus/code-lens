import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("rust");

describe("Rust — rename-symbol", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("generates rename diff for a function", async () => {
    if (!ctx.isServerInstalled) return;

    // Warm up server and ensure indexing is complete
    await runCLIWithRetry(
      ctx.fixtureDir,
      ["find-references", "--file", "src/main.rs", "--line", "1", "--col", "4"],
      { maxAttempts: 5, delayMs: 3_000 },
    );

    // main.rs line 1: fn greet — rename "greet" at col 5 (1-indexed, on identifier)
    const result = await runCLI(
      ctx.fixtureDir,
      [
        "rename-symbol",
        "--file",
        "src/main.rs",
        "--line",
        "1",
        "--col",
        "5",
        "--new-name",
        "say_hello",
      ],
    );

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("rename-greet");
  });
});
