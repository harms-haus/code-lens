import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("bash");

describe("Bash — hover", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows hover info for a function", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.sh: greet() function at line 3, col 1
    const result = await runCLISlow(ctx.fixtureDir, [
      "hover", "--file", "fixtures/valid.sh", "--line", "3", "--col", "1",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-greet");
  });
});
