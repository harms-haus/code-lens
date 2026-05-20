import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("cpp");

describe("C/C++ — diagnostics and navigation", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for a valid C file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, ["diagnostics", "--file", "fixtures/main.c"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("valid-c-diagnostics");
  });

  it("finds definition of add function from call site", async () => {
    if (!ctx.isServerInstalled) return;
    // main.c line 24: int sum = add(3, 4) — "add" at col 14
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-definition", "--file", "fixtures/main.c", "--line", "24", "--col", "14",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-add");
  });

  it("lists document symbols", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/main.c",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols");
  });

  it("shows hover info for a function", async () => {
    if (!ctx.isServerInstalled) return;
    // main.c line 3: int add — "add" at col 5
    const result = await runCLISlow(ctx.fixtureDir, [
      "hover", "--file", "fixtures/main.c", "--line", "3", "--col", "5",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-function");
  });
});
