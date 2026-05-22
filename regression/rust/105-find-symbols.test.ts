import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("rust");

describe("Rust — find-symbols", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("finds symbols matching 'greet'", async () => {
    if (!ctx.isServerInstalled) return;

    // Ensure server is running and indexed
    await runCLIWithRetry(
      ctx.fixtureDir,
      ["find-document-symbols", "--file", "src/main.rs"],
      { maxAttempts: 3, delayMs: 2_000 },
    );

    const result = await runCLI(ctx.fixtureDir, ["find-symbols", "--query", "greet", "--file", "src/main.rs"]);

    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized.length).toBeGreaterThan(0);
  });

  it("finds symbols matching 'Calculator'", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLI(ctx.fixtureDir, ["find-symbols", "--query", "Calculator", "--file", "src/main.rs"]);

    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized.length).toBeGreaterThan(0);
  });
});
