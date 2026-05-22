import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLIWithRetry, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("vue");

describe("Vue — find-symbols", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("finds symbols matching 'greet'", async () => {
    if (!ctx.isServerInstalled) return;

    // Warm up server with find-document-symbols first
    await runCLISlow(ctx.fixtureDir, [
      "find-document-symbols",
      "--file",
      "fixtures/valid.vue",
    ]);

    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-symbols",
      "--query",
      "greet",
      "--file",
      "fixtures/valid.vue",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("symbols-greet");
  });
});
