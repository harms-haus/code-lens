import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("vue");

describe("Vue — find-type-definition", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("finds type definition of count variable", async () => {
    if (!ctx.isServerInstalled) return;
    // references.vue line 4: const count = ref(0) — "count" at col 6
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-type-definition",
      "--file",
      "fixtures/references.vue",
      "--line",
      "4",
      "--col",
      "6",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(result.exitCode).toBe(0);
    expect(normalized.length).toBeGreaterThan(0);
  });
});
