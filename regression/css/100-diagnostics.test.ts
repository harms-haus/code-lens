import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("css");

describe("CSS — diagnostics", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for a valid CSS file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, ["diagnostics", "--file", "fixtures/valid.css"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("valid-css-diagnostics");
  });

  it("reports diagnostics for an invalid CSS file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "diagnostics", "--file", "fixtures/invalid.css",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("invalid-css-diagnostics");
  });
});
