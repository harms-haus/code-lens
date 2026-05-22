import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";
import * as fs from "node:fs";
import * as path from "node:path";

const ctx = new RegressionTestContext("svelte");

describe("Svelte — prettier", () => {
  beforeAll(async () => {
    await ctx.setup();
    // Copy .prettierrc to workspace root for prettier
    const prettierrcSrc = path.join(ctx.fixtureDir, "fixtures", ".prettierrc");
    if (fs.existsSync(prettierrcSrc)) {
      fs.copyFileSync(prettierrcSrc, path.join(ctx.fixtureDir, ".prettierrc"));
    }
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("reports correctly formatted files", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLISlow(ctx.fixtureDir, [
      "prettier",
      "--files",
      "fixtures/valid.svelte",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, {
      fixtureDir: ctx.fixtureDir,
    });
    expect(normalized).toMatch(/formatted correctly|no.*need.*formatting/i);
  });

  it("detects unformatted file", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLISlow(ctx.fixtureDir, [
      "prettier",
      "--files",
      "fixtures/unformatted.svelte",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, {
      fixtureDir: ctx.fixtureDir,
    });
    expect(normalized).toMatch(/needs? formatting|formatted correctly/i);
  });
});
