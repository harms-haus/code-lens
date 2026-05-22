import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("php");

describe("PHP — find-definition", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds definition of an imported function", async () => {
    if (!ctx.isServerInstalled) return;
    // references.php line 4: $message = greet("world") — "greet" at line 4, col 11
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-definition", "--file", "fixtures/references.php", "--line", "4", "--col", "11",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-greet");
  });
});
