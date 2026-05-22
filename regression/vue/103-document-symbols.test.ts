import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("vue");

describe("Vue — find-document-symbols", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 60_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("lists all symbols in valid.vue", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-document-symbols",
      "--file",
      "fixtures/valid.vue",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(result.exitCode).toBe(0);
    expect(normalized.length).toBeGreaterThan(0);
  });
});
