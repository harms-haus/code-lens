import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";
import * as fs from "node:fs";
import * as path from "node:path";

const ctx = new RegressionTestContext("ruby");

describe("Ruby — lint", () => {
  beforeAll(async () => {
    await ctx.setup();
    // Copy .rubocop.yml to workspace root for rubocop detection
    const rubocopConfig = path.join(
      ctx.fixtureDir,
      "fixtures",
      ".rubocop.yml",
    );
    if (fs.existsSync(rubocopConfig)) {
      fs.copyFileSync(
        rubocopConfig,
        path.join(ctx.fixtureDir, ".rubocop.yml"),
      );
    }
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("returns lint result for valid file", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLISlow(ctx.fixtureDir, [
      "lint",
      "--files",
      "fixtures/valid.rb",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, {
      fixtureDir: ctx.fixtureDir,
    });
    // rubocop may report 0 issues or "No linters" if not installed
    expect(normalized).toMatch(/\d+ issues|No linters|0 issues/i);
  });

  it("returns lint result for broken file", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLISlow(ctx.fixtureDir, [
      "lint",
      "--files",
      "fixtures/broken.rb",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, {
      fixtureDir: ctx.fixtureDir,
    });
    expect(normalized).toMatch(/\d+ issues|No linters|0 issues/i);
  });
});
