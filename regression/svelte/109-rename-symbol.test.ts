import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("svelte");

describe("Svelte — rename-symbol", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("generates rename diff for greet function", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.svelte line 2: function greet — rename "greet" at col 12
    const result = await runCLISlow(ctx.fixtureDir, [
      "rename-symbol",
      "--file",
      "fixtures/valid.svelte",
      "--line",
      "2",
      "--col",
      "12",
      "--new-name",
      "say_hello",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("rename-greet");
  });
});
