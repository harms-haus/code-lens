import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("python");

describe("Python — find-definition", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds definition of imported function", async () => {
    if (!ctx.isServerInstalled) return;
    // imports.py line 3: message = greet("world") — "greet" at line 3, col 19
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-definition", "--file", "fixtures/imports.py", "--line", "3", "--col", "19",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-greet");
  });
});
