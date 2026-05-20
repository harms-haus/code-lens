import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("bash");

describe("Bash — find-definition", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds definition of greet from references.sh", async () => {
    if (!ctx.isServerInstalled) return;
    // references.sh: result=$(greet "Alice") — "greet" is at col 10
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-definition", "--file", "fixtures/references.sh", "--line", "4", "--col", "10",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-greet");
  });
});
