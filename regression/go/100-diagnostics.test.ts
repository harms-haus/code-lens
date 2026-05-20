import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("go");

describe("Go — navigation", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for main.go", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, ["diagnostics", "--file", "fixtures/main.go"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("diagnostics-main");
  });

  it("finds references to greet function", async () => {
    if (!ctx.isServerInstalled) return;
    // main.go line 5: func greet — "greet" at col 6
    const result = await runCLI(ctx.fixtureDir, [
      "find-references", "--file", "fixtures/main.go", "--line", "5", "--col", "6",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("references-to-greet");
  });

  it("finds definition of greet from call site", async () => {
    if (!ctx.isServerInstalled) return;
    // main.go line 27: message := greet("world") — "greet" at col 14
    const result = await runCLI(ctx.fixtureDir, [
      "find-definition", "--file", "fixtures/main.go", "--line", "27", "--col", "14",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-greet");
  });

  it("lists document symbols and hover", async () => {
    if (!ctx.isServerInstalled) return;
    const symbolsResult = await runCLI(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/main.go",
    ]);
    const symbolsNormalized = normalizeOutput(symbolsResult.stdout, { fixtureDir: ctx.fixtureDir });
    // Verify real data
    expect(symbolsNormalized).toContain("Function greet");
    expect(symbolsNormalized).toMatchSnapshot("document-symbols");

    const hoverResult = await runCLI(ctx.fixtureDir, [
      "hover", "--file", "fixtures/main.go", "--line", "5", "--col", "6",
    ]);
    const hoverNormalized = normalizeOutput(hoverResult.stdout, { fixtureDir: ctx.fixtureDir });
    expect(hoverNormalized).toMatchSnapshot("hover-function");
  });
});
