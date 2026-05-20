import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("cpp");

describe("C/C++ — find-symbols", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("finds symbols matching 'add'", async () => {
    if (!ctx.isServerInstalled) return;

    // Warm up server first
    await runCLIWithRetry(
      ctx.fixtureDir,
      ["find-document-symbols", "--file", "fixtures/main.c"],
      { maxAttempts: 3, delayMs: 2_000 },
    );

    const result = await runCLI(ctx.fixtureDir, ["find-symbols", "--query", "add"]);

    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("symbols-add");
  });
});
