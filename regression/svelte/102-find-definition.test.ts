import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("svelte");

describe("Svelte — find-definition", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("finds definition of count variable", async () => {
    if (!ctx.isServerInstalled) return;
    // references.svelte line 5: const count = writable(0) — "count" at col 9
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-definition",
      "--file",
      "fixtures/references.svelte",
      "--line",
      "5",
      "--col",
      "9",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-count");
  });
});
