import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("vue");

describe("Vue — rename-symbol", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("generates rename diff for greet function", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.vue line 2: function greet — rename "greet" at col 10
    const result = await runCLISlow(ctx.fixtureDir, [
      "rename-symbol",
      "--file",
      "fixtures/valid.vue",
      "--line",
      "2",
      "--col",
      "10",
      "--new-name",
      "say_hello",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("rename-greet");
  });
});
