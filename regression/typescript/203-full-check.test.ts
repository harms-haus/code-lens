import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";
import * as fs from "node:fs";
import * as path from "node:path";

const ctx = new RegressionTestContext("typescript");

describe("TypeScript — fullCheck", () => {
  beforeAll(async () => {
    await ctx.setup();
    // Copy tsconfig.json to workspace root for tsc
    const tsconfigSrc = path.join(ctx.fixtureDir, "fixtures", "tsconfig.json");
    if (fs.existsSync(tsconfigSrc)) {
      fs.copyFileSync(tsconfigSrc, path.join(ctx.fixtureDir, "tsconfig.json"));
    }
    // Copy .prettierrc to workspace root for prettier
    const prettierrcSrc = path.join(ctx.fixtureDir, "fixtures", ".prettierrc");
    if (fs.existsSync(prettierrcSrc)) {
      fs.copyFileSync(prettierrcSrc, path.join(ctx.fixtureDir, ".prettierrc"));
    }
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("runs full check on valid files", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLISlow(ctx.fixtureDir, [
      "full-check",
      "--files",
      "fixtures/valid.ts",
      "--no-linters",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, {
      fixtureDir: ctx.fixtureDir,
    });
    expect(normalized).toMatchSnapshot("full-check-valid");
  });

  it("runs full check on broken files", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLISlow(ctx.fixtureDir, [
      "full-check",
      "--files",
      "fixtures/broken.ts",
      "--no-linters",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, {
      fixtureDir: ctx.fixtureDir,
    });
    expect(normalized).toMatchSnapshot("full-check-broken");
  });

  it("handles multiple files", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLISlow(ctx.fixtureDir, [
      "full-check",
      "--files",
      "fixtures/valid.ts,fixtures/broken.ts,fixtures/unformatted.ts",
      "--no-linters",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, {
      fixtureDir: ctx.fixtureDir,
    });
    expect(normalized).toMatchSnapshot("full-check-multi-file");
  });
});
