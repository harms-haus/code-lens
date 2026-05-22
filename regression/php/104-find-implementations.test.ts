import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("php");

describe("PHP — find-implementations", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("returns result for Calculator class", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-implementations", "--file", "fixtures/valid.php", "--line", "11", "--col", "7",
    ]);

    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("implementations-calculator");
  });
});
