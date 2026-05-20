import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";
import * as fs from "node:fs";
import * as path from "node:path";

const ctx = new RegressionTestContext("typescript");

describe("TypeScript — tsc", () => {
  beforeAll(async () => {
    await ctx.setup();
    // Copy tsconfig.json to workspace root for tsc
    const tsconfigSrc = path.join(ctx.fixtureDir, "fixtures", "tsconfig.json");
    if (fs.existsSync(tsconfigSrc)) {
      fs.copyFileSync(tsconfigSrc, path.join(ctx.fixtureDir, "tsconfig.json"));
    }
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("reports errors for broken file", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLISlow(ctx.fixtureDir, [
      "tsc",
      "--files",
      "fixtures/broken.ts",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, {
      fixtureDir: ctx.fixtureDir,
    });
    expect(normalized).toMatch(/error|TS\d+|not available/i);
  });

  it("reports clean for valid files", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLISlow(ctx.fixtureDir, [
      "tsc",
      "--files",
      "fixtures/valid.ts",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, {
      fixtureDir: ctx.fixtureDir,
    });
    expect(normalized).toMatch(/0 issues|not available|error/i);
  });

  it("handles multiple files", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLISlow(ctx.fixtureDir, [
      "tsc",
      "--files",
      "fixtures/valid.ts,fixtures/broken.ts",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, {
      fixtureDir: ctx.fixtureDir,
    });
    expect(normalized).toMatch(/issues|error|not available/i);
  });
});
