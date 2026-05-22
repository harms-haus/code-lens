import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";
import * as fs from "node:fs";
import * as path from "node:path";

const ctx = new RegressionTestContext("markdown");

describe("Markdown — prettier", () => {
  beforeAll(async () => {
    await ctx.setup();
    const prettierrcSrc = path.join(ctx.fixtureDir, "fixtures", ".prettierrc");
    if (fs.existsSync(prettierrcSrc)) {
      fs.copyFileSync(prettierrcSrc, path.join(ctx.fixtureDir, ".prettierrc"));
    }
  }, 120_000);

  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports correctly formatted Markdown files", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLISlow(ctx.fixtureDir, [
      "prettier", "--files", "fixtures/valid.md",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/formatted correctly|no.*need.*formatting/i);
  });

  it("detects unformatted Markdown file", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLISlow(ctx.fixtureDir, [
      "prettier", "--files", "fixtures/unformatted.md",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/needs? formatting/i);
  });
});
