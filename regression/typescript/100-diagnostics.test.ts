import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("typescript");

describe("TypeScript — diagnostics", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("reports no diagnostics for a valid file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "diagnostics",
      "--file",
      "fixtures/valid.ts",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("valid-file-diagnostics");
  });

  it("reports errors for a broken file", async () => {
    if (!ctx.isServerInstalled) return;
    // Run with --refresh to force fresh diagnostics
    const result = await runCLI(ctx.fixtureDir, [
      "diagnostics",
      "--file",
      "fixtures/broken.ts",
      "--refresh",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("broken-file-diagnostics");
  });

  it("reports diagnostics for multiple files", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "diagnostics",
      "--files",
      "fixtures/valid.ts,fixtures/broken.ts",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("multi-file-diagnostics");
  });

  it("errors on unsupported file extension", async () => {
    if (!ctx.isServerInstalled) return;
    const unsupportedFile = "fixtures/test.xyz";
    const { writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    writeFileSync(join(ctx.fixtureDir, unsupportedFile), "content");

    const result = await runCLI(ctx.fixtureDir, [
      "diagnostics",
      "--file",
      unsupportedFile,
    ]);
    expect(result.exitCode).not.toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toContain("No LSP server configured");
  });
});
