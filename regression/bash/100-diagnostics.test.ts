import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("bash");

describe("Bash — diagnostics and symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for a valid file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "diagnostics", "--file", "fixtures/valid.sh",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("valid-file-diagnostics");
  });

  it("lists document symbols with function names and line numbers", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/valid.sh",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    // Verify we got real symbol data (not empty/error)
    expect(normalized).toContain("Function greet");
    expect(normalized).toContain("Function farewell");
    expect(normalized).toContain("Function main");
    expect(normalized).toMatchSnapshot("document-symbols");
  });

  it("finds references to a function", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.sh line 3: greet() — "greet" at col 1
    const result = await runCLI(ctx.fixtureDir, [
      "find-references", "--file", "fixtures/valid.sh", "--line", "3", "--col", "1",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("references-to-greet");
  });
});
