import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("yaml");

describe("YAML — diagnostics and symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for valid YAML", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, ["diagnostics", "--file", "fixtures/valid.yaml"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("valid-yaml-diagnostics");
  });

  it("lists document symbols with key names and validates structure", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/valid.yaml",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    // Validate the YAML structure is correctly parsed into symbols
    expect(normalized).toContain("name");
    expect(normalized).toContain("version");
    expect(normalized).toContain("dependencies");
    expect(normalized).toContain("scripts");
    expect(normalized).toContain("build");
    expect(normalized).toContain("test");
    expect(normalized).toMatchSnapshot("document-symbols");
  });

  it("returns correct language identification for YAML files", async () => {
    if (!ctx.isServerInstalled) return;
    // Use diagnostics to verify the YAML language is correctly identified
    const result = await runCLI(ctx.fixtureDir, [
      "diagnostics", "--file", "fixtures/valid.yaml",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("(yaml)");
  });
});
