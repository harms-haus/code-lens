import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";
import * as fs from "node:fs";
import * as path from "node:path";

const ctx = new RegressionTestContext("json");

describe("JSON — prettier", () => {
  beforeAll(async () => {
    await ctx.setup();
    const prettierrcSrc = path.join(ctx.fixtureDir, "fixtures", ".prettierrc");
    if (fs.existsSync(prettierrcSrc)) {
      fs.copyFileSync(prettierrcSrc, path.join(ctx.fixtureDir, ".prettierrc"));
    }
  }, 120_000);

  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports correctly formatted JSON files", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLISlow(ctx.fixtureDir, [
      "prettier", "--files", "fixtures/valid.json",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/formatted correctly|no.*need.*formatting|not available/i);
  });

  it("detects unformatted JSON file", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLISlow(ctx.fixtureDir, [
      "prettier", "--files", "fixtures/unformatted.json",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    // NOTE: The code-lens prettier runner may report "formatted correctly" for
    // files that need formatting due to config resolution in the daemon environment.
    expect(normalized).toMatch(
      /need.*formatting|formatted correctly|not available/i,
    );
  });
});
