import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("vue");

describe("Vue — lint", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("returns result when no linters are installed", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLISlow(ctx.fixtureDir, [
      "lint",
      "--files",
      "fixtures/valid.vue",
    ]);

    const normalized = normalizeOutput(result.stdout, {
      fixtureDir: ctx.fixtureDir,
    });
    expect(normalized).toMatch(/\d+ issues? found|No issues found|No linters detected/i);
  });

  it("handles multiple files", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLISlow(ctx.fixtureDir, [
      "lint",
      "--files",
      "fixtures/valid.vue,fixtures/broken.vue",
    ]);

    const normalized = normalizeOutput(result.stdout, {
      fixtureDir: ctx.fixtureDir,
    });
    expect(normalized).toMatch(/\d+ issues? found|No linters detected/i);
  });
});
