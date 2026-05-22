import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("html");

describe("HTML — diagnostics", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports no diagnostics for a valid HTML file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, ["diagnostics", "--file", "fixtures/valid.html"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("valid-html-diagnostics");
  });

  it("reports diagnostics for a broken HTML file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, ["diagnostics", "--file", "fixtures/broken.html"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("broken-html-diagnostics");
  });
});
