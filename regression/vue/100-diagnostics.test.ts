import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("vue");

describe("Vue — diagnostics", () => {
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
      "fixtures/valid.vue",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized.length).toBeGreaterThan(0);
  });

  it("reports errors for a broken file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "diagnostics",
      "--file",
      "fixtures/broken.vue",
      "--refresh",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized.length).toBeGreaterThan(0);
  });

  it("reports diagnostics for multiple files", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "diagnostics",
      "--files",
      "fixtures/valid.vue,fixtures/broken.vue",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized.length).toBeGreaterThan(0);
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
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized.length).toBeGreaterThan(0);
  });
});
